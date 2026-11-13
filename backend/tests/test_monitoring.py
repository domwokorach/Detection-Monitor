from datetime import datetime, timedelta, timezone
from decimal import Decimal
from sqlalchemy import select, func
from app.models import Transaction, Alert, RuleMatch, OutboxEvent, AuditEvent
from app.services.screening import drain
from app.services.audit import verify_chain
from app.services.rules import validate_config, RuleConfigurationError
import pytest


def new_tx(external_id='BANK-TEST-01', amount='14000.00', account_id='acct-personal-03', country='GB', minutes=0):
    return dict(external_id=external_id, account_id=account_id, amount=amount, currency='GBP',
                direction='DEBIT', counterparty='Testing Company Ltd', country=country,
                occurred_at=(datetime.now(timezone.utc) + timedelta(minutes=minutes)).isoformat())


def test_large_payment_creates_alert_and_rule_snapshot(system):
    client, maker, headers = system
    resp = client.post('/api/transactions', json=new_tx(), headers=headers)
    assert resp.status_code == 201, resp.text
    txid = resp.json()['id']
    with maker() as db:
        assert drain(db, limit=100) >= 1
        tx = db.get(Transaction, txid)
        assert tx.screening_status == 'SCREENED'
        assert tx.risk_score >= 50
        alert = db.scalar(select(Alert).where(Alert.transaction_id == txid))
        assert alert and alert.status == 'OPEN'
        matches = db.scalars(select(RuleMatch).where(RuleMatch.transaction_id == txid)).all()
        assert any(m.rule_code == 'LARGE_AMOUNT' and m.rule_version == 1 for m in matches)
        assert verify_chain(db)['valid']
    detail = client.get(f'/api/transactions/{txid}', headers=headers)
    assert detail.status_code == 200
    assert len(detail.json()['matches']) >= 1


def test_watchlist_and_velocity_are_deterministic(system):
    client, maker, headers = system
    payloads = [new_tx('WATCH-01', amount='120', country='ZZ', account_id='acct-personal-03', minutes=5)]
    payloads.extend(new_tx(f'VEL-{i}', amount='170', account_id='acct-personal-03', minutes=10+i) for i in range(3))
    ids = []
    for payload in payloads:
        res = client.post('/api/transactions', json=payload, headers=headers)
        assert res.status_code == 201, res.text
        ids.append(res.json()['id'])
    with maker() as db:
        drain(db, limit=100)
        watched = db.get(Transaction, ids[0])
        assert watched.risk_score >= 65
        last = db.get(Transaction, ids[-1])
        assert last.risk_score >= 45
        matches = db.scalars(select(RuleMatch).where(RuleMatch.transaction_id == last.id)).all()
        assert any(m.rule_code == 'HIGH_VELOCITY' for m in matches)


def test_idempotent_ingestion_and_conflicting_duplicate(system):
    client, maker, headers = system
    payload = new_tx()
    first = client.post('/api/transactions', json=payload, headers=headers)
    again = client.post('/api/transactions', json=payload, headers=headers)
    assert first.status_code == 201 and again.status_code in (200, 201)
    assert first.json()['id'] == again.json()['id']
    different = dict(payload, amount='10.00')
    assert client.post('/api/transactions', json=different, headers=headers).status_code == 409
    with maker() as db:
        tx = db.scalar(select(Transaction).where(Transaction.external_id == payload['external_id']))
        n = db.scalar(select(func.count(OutboxEvent.id)).where(OutboxEvent.aggregate_id == tx.id))
        assert n == 1


def test_investigation_requires_evidence_and_audits_outcome(system):
    client, maker, headers = system
    txid = client.post('/api/transactions', json=new_tx(), headers=headers).json()['id']
    with maker() as db:
        drain(db, limit=100)
        alert = db.scalar(select(Alert).where(Alert.transaction_id == txid))
        alert_id = alert.id
    detail = client.get(f'/api/alerts/{alert_id}', headers=headers)
    assert detail.status_code == 200
    assert detail.json()['matches']
    invalid = client.patch(f'/api/alerts/{alert_id}', json={'status':'CLOSED','disposition':'FALSE_POSITIVE','note':'too short'}, headers=headers)
    assert invalid.status_code == 422
    review = client.patch(f'/api/alerts/{alert_id}', json={'status':'IN_REVIEW','assign_to_me':True,'note':'Reviewing supporting documents'}, headers=headers)
    assert review.status_code == 200
    closed = client.patch(f'/api/alerts/{alert_id}', json={'status':'CLOSED','disposition':'SUSPICIOUS','note':'Multiple irregular payments warrant escalation'}, headers=headers)
    assert closed.status_code == 200 and closed.json()['status'] == 'CLOSED'
    assert closed.json()['disposition'] == 'SUSPICIOUS'
    assert client.patch(f'/api/alerts/{alert_id}', json={'status':'OPEN'}, headers=headers).status_code == 409
    with maker() as db:
        assert verify_chain(db)['valid']
        actions = db.scalars(select(AuditEvent.action)).all()
        assert actions.count('ALERT_REVIEWED') == 2


def test_admin_rule_update_is_versioned_and_access_controlled(system):
    client, maker, headers = system
    rule = next(r for r in client.get('/api/rules',headers=headers).json() if r['code']=='LARGE_AMOUNT')
    change = client.patch(f"/api/rules/{rule['id']}", json={'expected_version':1,'config':{'minimum':'12500'}}, headers=headers)
    assert change.status_code == 200 and change.json()['version'] == 2
    assert change.json()['config']['minimum'] == '12500'
    assert client.patch(f"/api/rules/{rule['id']}", json={'expected_version':1,'enabled':False}, headers=headers).status_code == 409
    assert client.patch(f"/api/rules/{rule['id']}", json={'expected_version':2,'config':{'minimum':'-10'}}, headers=headers).status_code == 422
    analyst = client.post('/api/auth/login',json={'email':'analyst@demo.local','password':'ChangeMe123!'}).json()['access_token']
    analyst_headers = {'Authorization':f'Bearer {analyst}'}
    assert client.post('/api/rules',json={'code':'TEST_NEW','name':'Example test','kind':'AMOUNT_THRESHOLD','config':{'minimum':'9000'},'weight':30},headers=analyst_headers).status_code == 403


def test_audit_chain_detects_modifications(system):
    client, maker, headers = system
    with maker() as db:
        assert verify_chain(db)['valid']
        first = db.scalar(select(AuditEvent).order_by(AuditEvent.seq).limit(1))
        first.action = 'FORGED_ACTION'
        db.commit()
        result = verify_chain(db)
        assert result['valid'] is False
        assert result['broken_at_seq'] == first.seq
    assert client.get('/api/audit/verify', headers=headers).json()['valid'] is False


def test_same_transaction_cannot_be_screened_twice(system):
    client, maker, headers = system
    txid = client.post('/api/transactions', json=new_tx(), headers=headers).json()['id']
    with maker() as db:
        drain(db, limit=100)
        original_matches = db.scalar(select(func.count(RuleMatch.id)).where(RuleMatch.transaction_id == txid))
        db.add(OutboxEvent(event_type='TRANSACTION_RECEIVED',aggregate_id=txid,payload={}))
        db.commit()
        drain(db,limit=10)
        final_matches = db.scalar(select(func.count(RuleMatch.id)).where(RuleMatch.transaction_id == txid))
        assert final_matches == original_matches
        assert db.scalar(select(func.count(Alert.id)).where(Alert.transaction_id == txid)) == 1


def test_rule_config_validation():
    assert validate_config('VELOCITY',{'min_count':3,'window_minutes':10})['min_count']==3
    with pytest.raises(RuleConfigurationError):
        validate_config('AMOUNT_THRESHOLD',{'minimum':'NaN'})
    with pytest.raises(RuleConfigurationError):
        validate_config('COUNTRY_WATCHLIST',{'countries':['AAA']})


def test_accounts_expose_local_authority_and_legacy_db_is_upgraded(system, tmp_path):
    from sqlalchemy import create_engine, text
    from app.main import ensure_account_la_code
    import app.main as main_module
    client, _maker, headers = system
    by_id = {a['id']: a for a in client.get('/api/accounts', headers=headers).json()}
    assert by_id['acct-retail-01']['la_code'] == 'E08000003'
    legacy = create_engine(f"sqlite:///{tmp_path / 'legacy.db'}")
    with legacy.begin() as c:
        c.execute(text('CREATE TABLE accounts (id VARCHAR(36) PRIMARY KEY, holder_name VARCHAR(120))'))
    main_module.engine = legacy
    ensure_account_la_code()
    ensure_account_la_code()  # idempotent
    with legacy.connect() as c:
        assert 'la_code' in [r[1] for r in c.execute(text('PRAGMA table_info(accounts)'))]


def test_truelayer_import_is_admin_only_stateful_and_idempotent(system, monkeypatch):
    from app.config import settings
    from app.services import truelayer
    client, maker, headers = system
    import dataclasses
    monkeypatch.setattr(truelayer, 'settings', dataclasses.replace(
        settings, truelayer_client_id='sandbox-x', truelayer_client_secret='s'))
    monkeypatch.setattr(truelayer, 'exchange_code', lambda code: 'tok')
    monkeypatch.setattr(truelayer, 'fetch_accounts', lambda t: [{'account_id': 'tlacct1', 'display_name': 'Mock Current',
                                                                 'account_number': {'number': '12345678'}}])
    ts = datetime.now(timezone.utc).isoformat()
    monkeypatch.setattr(truelayer, 'fetch_transactions', lambda t, a: [
        {'transaction_id': 'a1', 'timestamp': ts, 'amount': -12500.5, 'currency': 'GBP', 'transaction_type': 'DEBIT', 'merchant_name': 'Big Spend'},
        {'transaction_id': 'a2', 'timestamp': ts, 'amount': 0, 'currency': 'GBP', 'transaction_type': 'CREDIT', 'description': 'zero'}])

    url = client.get('/api/truelayer/connect', headers=headers)
    assert url.status_code == 200 and 'providers=uk-cs-mock' in url.json()['auth_url']
    state = url.json()['auth_url'].split('state=')[1]
    assert client.post('/api/truelayer/import', headers=headers, json={'code': 'c', 'state': 'bad'}).status_code == 400
    first = client.post('/api/truelayer/import', headers=headers, json={'code': 'c', 'state': state})
    assert first.status_code == 200 and first.json() == {'accounts': 1, 'imported': 1, 'skipped': 1}
    again = client.post('/api/truelayer/import', headers=headers, json={'code': 'c', 'state': state})
    assert again.json()['imported'] == 0
    with maker() as db:
        drain(db, limit=100)  # seed data also has queued events
        tx = db.scalar(select(Transaction).where(Transaction.external_id == 'tl-a1'))
        assert tx.screening_status == 'SCREENED' and tx.alert is not None
    analyst = client.post('/api/auth/login', json={'email': 'analyst@demo.local', 'password': 'ChangeMe123!'}).json()['access_token']
    assert client.get('/api/truelayer/connect', headers={'Authorization': f'Bearer {analyst}'}).status_code == 403


def test_logout_revokes_token_server_side(system):
    client, _, headers = system
    assert client.get('/api/me', headers=headers).status_code == 200
    assert client.post('/api/auth/logout', headers=headers).status_code == 204
    assert client.get('/api/me', headers=headers).status_code == 401
