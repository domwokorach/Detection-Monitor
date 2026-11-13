from datetime import datetime, timezone
from sqlalchemy import select
import pytest
from app.models import Alert, AuditEvent, Transaction
from app.services.audit import verify_chain
from app.services.investigation import mask_address, mask_ip
from app.services.screening import drain


@pytest.fixture
def seeded(system):
    client, maker, admin = system
    with maker() as db:
        drain(db, limit=500)
    login = client.post('/api/auth/login', json={'email': 'analyst@demo.local', 'password': 'ChangeMe123!'})
    analyst = {'Authorization': f"Bearer {login.json()['access_token']}"}
    return client, maker, admin, analyst


def alert_for(maker, external_id):
    with maker() as db:
        return db.scalar(select(Alert).join(Transaction).where(Transaction.external_id == external_id)).id


def test_masking_helpers():
    assert mask_ip('203.0.113.24') == '203.0.113.•••'
    assert mask_ip('2001:db8::1').startswith('2001:0db8:')
    masked = mask_address({'line1': '14 Example Street', 'line2': None, 'postcode': 'EC1A 1BB', 'city': 'London'})
    assert masked['postcode'] == 'EC1A •••' and masked['line1'].startswith('1') and 'Example' not in masked['line1'] and masked['line2'] is None
    assert masked['city'] == 'London'


def test_admin_sees_full_pii_analyst_sees_masked(seeded):
    client, maker, admin, analyst = seeded
    aid = alert_for(maker, 'SYN-006')
    full = client.get(f'/api/alerts/{aid}/investigation', headers=admin).json()
    assert full['ip']['address'] == '198.51.100.77' and full['ip']['masked'] is False and full['can_view_pii'] is True
    assert full['addresses']['customer']['postcode'] == 'EC1A 1BB'
    masked = client.get(f'/api/alerts/{aid}/investigation', headers=analyst).json()
    assert masked['ip']['address'] == '198.51.100.•••' and masked['ip']['masked'] is True and masked['can_view_pii'] is False
    assert masked['addresses']['customer']['postcode'] == 'EC1A •••' and masked['addresses']['masked'] is True
    assert '198.51.100.77' not in str(masked) and 'Sample Lane' not in str(masked)
    assert client.get(f'/api/alerts/{aid}/investigation').status_code == 401


def test_ip_geo_is_marked_inferred_and_missing_values_stay_null(seeded):
    client, maker, admin, _ = seeded
    data = client.get(f"/api/alerts/{alert_for(maker, 'SYN-006')}/investigation", headers=admin).json()
    geo = data['ip']['geo']
    assert geo['inferred'] is True and geo['provider'] == 'synthetic-demo' and geo['country'] == 'DE'
    assert data['ip']['network']['asn'] == 'AS64497' and data['ip']['vpn_proxy'] is True
    assert data['addresses']['merchant'] is None  # never invented
    # an alert with no telemetry at all
    with maker() as db:
        none_id = db.scalar(select(Alert.id).join(Transaction).where(Transaction.external_id.in_(['SYN-001', 'SYN-003', 'SYN-004', 'SYN-007', 'SYN-008', 'SYN-010']))) or alert_for(maker, 'SYN-002')
    bare = client.get(f'/api/alerts/{none_id}/investigation', headers=admin).json()
    if bare['ip'] is None:
        statuses = {f['code']: f['status'] for f in bare['factors']}
        assert statuses['IP_COUNTRY_MISMATCH'] == 'unavailable' and statuses['SHARED_IP'] == 'unavailable'


def test_factors_shared_ip_mismatch_and_linked(seeded):
    client, maker, admin, _ = seeded
    data = client.get(f"/api/alerts/{alert_for(maker, 'SYN-006')}/investigation", headers=admin).json()
    f = {x['code']: x for x in data['factors']}
    assert f['SHARED_IP']['status'] == 'flagged'          # two accounts use 198.51.100.77
    assert f['IP_COUNTRY_MISMATCH']['status'] == 'flagged'  # IP and destination are DE, but the account's home is GB
    assert f['HIGH_VALUE']['status'] == 'flagged'
    assert data['ip']['accounts_sharing'] == 2 and data['ip']['related_transactions'] >= 2
    assert any('Same source IP' in l['reason'] for l in data['linked'])
    assert all(p['risk_score'] >= 60 for p in data['related_points'])


def test_timestamps_and_timeline_follow_audit(seeded):
    client, maker, admin, _ = seeded
    aid = alert_for(maker, 'SYN-006')
    assert client.post(f'/api/alerts/{aid}/evidence-reviewed', json={'note': 'Checked IP history'}, headers=admin).status_code == 201
    review = client.patch(f'/api/alerts/{aid}', json={'status': 'IN_REVIEW', 'assign_to_me': True, 'note': 'Looking into VPN usage'}, headers=admin)
    assert review.status_code == 200
    data = client.get(f'/api/alerts/{aid}/investigation', headers=admin).json()
    kinds = [t['kind'] for t in data['timeline']]
    assert kinds[0] == 'received' and 'rules' in kinds and 'alert' in kinds
    for k in ('evidence', 'assigned', 'opened', 'note'):
        assert k in kinds
    assert data['assignee']['display_name'] == 'Morgan Admin'
    ts = data['timestamps']
    assert ts['reviewed'] and ts['processing_seconds'] is not None and ts['processing_seconds'] >= 0
    assert datetime.fromisoformat(ts['detected']).tzinfo is not None
    assert all(t['actor'] for t in data['timeline'])
    with maker() as db:
        assert verify_chain(db)['valid']


def test_pii_view_is_audited_once_per_window_and_never_for_analysts(seeded):
    client, maker, admin, analyst = seeded
    aid = alert_for(maker, 'SYN-006')
    for _ in range(3):
        client.get(f'/api/alerts/{aid}/investigation', headers=admin)
        client.get(f'/api/alerts/{aid}/investigation', headers=analyst)
    with maker() as db:
        rows = db.scalars(select(AuditEvent).where(AuditEvent.action == 'INVESTIGATION_PII_VIEWED')).all()
        assert [r.actor for r in rows] == ['admin@demo.local']


def test_evidence_reviewed_rules(seeded):
    client, maker, admin, analyst = seeded
    aid = alert_for(maker, 'SYN-006')
    assert client.post(f'/api/alerts/{aid}/evidence-reviewed', json={}).status_code == 401
    assert client.post('/api/alerts/nope/evidence-reviewed', json={}, headers=admin).status_code == 404
    client.patch(f'/api/alerts/{aid}', json={'status': 'IN_REVIEW', 'assign_to_me': True}, headers=admin)
    assert client.post(f'/api/alerts/{aid}/evidence-reviewed', json={}, headers=analyst).status_code == 403
    client.patch(f'/api/alerts/{aid}', json={'status': 'CLOSED', 'disposition': 'SUSPICIOUS', 'note': 'Confirmed mule activity'}, headers=admin)
    assert client.post(f'/api/alerts/{aid}/evidence-reviewed', json={}, headers=admin).status_code == 409


def test_ingestion_accepts_validated_context_and_stays_idempotent(system):
    client, maker, headers = system
    payload = dict(external_id='CTX-1', account_id='acct-personal-03', amount='20.00', currency='GBP', direction='DEBIT', counterparty='Corner Shop',
                   country='GB', occurred_at=datetime.now(timezone.utc).isoformat(), context={'source_ip': '2001:db8::1', 'geo_country': 'gb', 'is_vpn': False})
    first = client.post('/api/transactions', json=payload, headers=headers)
    again = client.post('/api/transactions', json=payload, headers=headers)
    assert first.status_code == 201 and again.status_code == 200
    bad = {**payload, 'external_id': 'CTX-2', 'context': {'source_ip': 'not-an-ip'}}
    assert client.post('/api/transactions', json=bad, headers=headers).status_code == 422
    out_of_range = {**payload, 'external_id': 'CTX-3', 'context': {'source_ip': '203.0.113.1', 'geo_lat': 123}}
    assert client.post('/api/transactions', json=out_of_range, headers=headers).status_code == 422
    with maker() as db:
        tx = db.scalar(select(Transaction).where(Transaction.external_id == 'CTX-1'))
        assert tx.context.source_ip == '2001:db8::1' and tx.context.geo_country == 'GB' and tx.context.geo_lat is None
