import csv
import io
import time
import pytest
from sqlalchemy import select, update
from app.config import settings
from app.models import Alert, AuditEvent, Transaction
from app.services import register
from app.services.screening import drain


@pytest.fixture
def seeded(system):
    client, maker, admin = system
    with maker() as db:
        drain(db, limit=500)
    login = client.post('/api/auth/login', json={'email': 'analyst@demo.local', 'password': 'ChangeMe123!'})
    analyst = {'Authorization': f"Bearer {login.json()['access_token']}"}
    return client, maker, admin, analyst


def setting(monkeypatch, name, value):
    """Settings is a frozen dataclass; bypass the freeze for the duration of one test."""
    monkeypatch.setattr(type(settings), '__setattr__', object.__setattr__)
    monkeypatch.setattr(settings, name, value)


def parse(resp):
    return list(csv.DictReader(io.StringIO(resp.text)))


def audits(maker, action):
    with maker() as db:
        return db.scalars(select(AuditEvent).where(AuditEvent.action == action).order_by(AuditEvent.seq)).all()


def test_list_filters_sort_and_pagination(seeded):
    client, _, admin, _ = seeded
    body = client.get('/api/investigations?page_size=3&sort=risk&direction=desc', headers=admin).json()
    assert body['total'] >= 3 and len(body['items']) == 3
    scores = [r['risk_score'] for r in body['items']]
    assert scores == sorted(scores, reverse=True)
    high = client.get('/api/investigations?severity=critical,high&page_size=100', headers=admin).json()
    assert all(r['risk_score'] >= 70 for r in high['items'])
    lo = client.get('/api/investigations?risk_min=60&risk_max=69&page_size=100', headers=admin).json()
    assert all(60 <= r['risk_score'] <= 69 for r in lo['items'])
    assert client.get('/api/investigations?status=NOPE', headers=admin).status_code == 422
    assert client.get('/api/investigations?end_date=2020-01-01&start_date=2020-02-01', headers=admin).status_code == 422
    assert client.get('/api/investigations').status_code == 401


def test_summary_separates_exposure_from_confirmed_loss(seeded):
    client, maker, admin, _ = seeded
    s = client.get('/api/investigations/summary', headers=admin).json()
    with maker() as db:
        expected = sum(t.amount for a, t in db.execute(select(Alert, Transaction).join(Transaction, Transaction.id == Alert.transaction_id))
                       if a.status != 'CLOSED' and t.currency == 'GBP' and t.direction == 'DEBIT')
    assert s['total'] == s['active'] + 0 or s['total'] >= s['active']
    assert float(s['suspected_exposure_gbp']) == pytest.approx(float(expected))
    assert s['confirmed_loss_gbp'] == '0.00' and s['avg_resolution_seconds'] is None


def test_confirmed_loss_flow_updates_kpis_and_clears_exposure(seeded):
    client, maker, admin, _ = seeded
    row = client.get('/api/investigations?sort=amount&direction=desc&status=OPEN&page_size=1', headers=admin).json()['items'][0]
    before = client.get('/api/investigations/summary', headers=admin).json()
    assert row['suspected_exposure'] is not None and row['confirmed_loss'] is None
    # loss only valid when closing as confirmed suspicious, and never above the transaction amount
    bad = client.patch(f"/api/alerts/{row['id']}", headers=admin, json={'status': 'IN_REVIEW', 'confirmed_loss': '10.00'})
    assert bad.status_code == 422
    over = client.patch(f"/api/alerts/{row['id']}", headers=admin, json={'status': 'IN_REVIEW', 'assign_to_me': True})
    assert over.status_code == 200
    too_much = client.patch(f"/api/alerts/{row['id']}", headers=admin, json={'status': 'CLOSED', 'disposition': 'SUSPICIOUS', 'note': 'confirmed fraud case', 'confirmed_loss': '99999999.00'})
    assert too_much.status_code == 422
    ok = client.patch(f"/api/alerts/{row['id']}", headers=admin, json={'status': 'CLOSED', 'disposition': 'SUSPICIOUS', 'note': 'confirmed fraud case', 'confirmed_loss': '250.50'})
    assert ok.status_code == 200, ok.text
    after = client.get('/api/investigations/summary', headers=admin).json()
    assert after['confirmed_loss_gbp'] == '250.50'
    assert float(after['suspected_exposure_gbp']) == pytest.approx(float(before['suspected_exposure_gbp']) - float(row['amount']))
    assert after['resolved_count'] == 1 and after['avg_resolution_seconds'] is not None
    closed = client.get(f"/api/investigations?q={row['transaction_id']}", headers=admin).json()['items'][0]
    assert closed['suspected_exposure'] is None and closed['confirmed_loss'] == '250.50' and closed['opened_at'] and closed['status'] == 'CLOSED'


def test_events_are_real_audit_entries(seeded):
    client, maker, admin, _ = seeded
    row = client.get('/api/investigations?page_size=1', headers=admin).json()
    cursor = row['cursor']
    with maker() as db:
        assert register.events_after(db, cursor) == []
    client.patch(f"/api/alerts/{row['items'][0]['id']}", headers=admin, json={'status': 'ESCALATED', 'assign_to_me': True})
    with maker() as db:
        events = register.events_after(db, cursor)
    assert [e['kind'] for e in events] == ['escalated'] and events[0]['alert_id'] == row['items'][0]['id']


def test_csv_export_columns_filters_headers_and_audit(seeded):
    client, maker, admin, _ = seeded
    resp = client.get('/api/investigations/export.csv?severity=critical,high', headers=admin)
    assert resp.status_code == 200
    assert resp.headers['content-type'] == 'text/csv; charset=utf-8'
    assert resp.headers['content-disposition'].startswith('attachment; filename="detection-monitor-investigations-')
    rows = parse(resp)
    assert list(rows[0].keys()) == register.CSV_COLUMNS
    assert rows and all(int(r['risk_score']) >= 70 for r in rows)
    assert int(resp.headers['x-export-rows']) == len(rows)
    assert all(r['detected_time_utc'].endswith('Z') and 'T' in r['detected_time_utc'] for r in rows)
    assert all('£' not in r['transaction_amount_gbp'] for r in rows)
    assert len({r['transaction_id'] for r in rows}) == len(rows)
    ev = audits(maker, 'INVESTIGATIONS_EXPORTED')[-1]
    assert ev.actor == 'admin@demo.local' and ev.after['row_count'] == len(rows) and ev.after['filters']['severity'] == ['critical', 'high']
    assert 'token' not in str(ev.after).lower()


def test_scopes_page_selected_all(seeded):
    client, _, admin, _ = seeded
    page = client.get('/api/investigations?page_size=2', headers=admin).json()['items']
    ids = '&'.join(f"ids={r['id']}" for r in page)
    assert len(parse(client.get(f'/api/investigations/export.csv?scope=page&{ids}', headers=admin))) == 2
    assert client.get('/api/investigations/export.csv?scope=selected', headers=admin).status_code == 422
    total = client.get('/api/investigations?page_size=1', headers=admin).json()['total']
    assert len(parse(client.get('/api/investigations/export.csv?scope=all&severity=critical', headers=admin))) == total  # filters ignored


def test_analyst_export_masks_ip_and_roles_are_enforced(seeded, monkeypatch):
    client, maker, admin, analyst = seeded
    a = parse(client.get('/api/investigations/export.csv?scope=all', headers=analyst))
    b = parse(client.get('/api/investigations/export.csv?scope=all', headers=admin))
    ips_a, ips_b = [r['ip_address'] for r in a if r['ip_address']], [r['ip_address'] for r in b if r['ip_address']]
    assert ips_b and all('•' in ip for ip in ips_a) and not any('•' in ip for ip in ips_b)
    setting(monkeypatch, 'export_roles', 'admin')
    assert client.get('/api/investigations/export.csv', headers=analyst).status_code == 403
    assert audits(maker, 'INVESTIGATIONS_EXPORT_DENIED')


def test_formula_injection_is_neutralised():
    for bad in ('=SUM(A1)', '+1', '-2', '@x', ' =1', '\t=1'):
        assert register.safe_cell(bad).startswith("'")
    assert register.safe_cell('Tesco') == 'Tesco' and register.safe_cell(None) == '' and register.safe_cell(12.5) == 12.5 and register.safe_cell('  ') == '  '


def test_export_requires_auth_and_revoked_token_rejected(seeded):
    client, _, admin, _ = seeded
    assert client.get('/api/investigations/export.csv').status_code == 401
    client.post('/api/auth/logout', headers=admin)
    assert client.get('/api/investigations/export.csv', headers=admin).status_code == 401


def test_large_export_runs_as_private_single_use_job(seeded, monkeypatch, tmp_path):
    client, maker, admin, analyst = seeded
    setting(monkeypatch, 'export_async_threshold', 1)
    setting(monkeypatch, 'export_dir', str(tmp_path / 'exports'))
    resp = client.get('/api/investigations/export.csv?scope=all', headers=admin)
    assert resp.status_code == 202, resp.text
    job = resp.json()
    for _ in range(100):
        status = client.get(job['status_url'], headers=admin).json()
        if status['status'] in ('READY', 'FAILED'):
            break
        time.sleep(0.1)
    assert status['status'] == 'READY', status
    assert client.get(job['status_url'], headers=analyst).status_code == 404            # other users cannot see it
    assert client.get(status['download_url']).status_code == 401                        # not a public URL
    assert client.get(status['download_url'], headers=analyst).status_code == 404
    dl = client.get(status['download_url'], headers=admin)
    assert dl.status_code == 200 and len(parse(dl)) == status['total']
    assert list(parse(dl)[0].keys()) == register.CSV_COLUMNS
    assert client.get(status['download_url'], headers=admin).status_code == 410         # single use
    assert not any((tmp_path / 'exports').iterdir())                                    # file securely deleted
    for action in ('INVESTIGATIONS_EXPORT_REQUESTED', 'INVESTIGATIONS_EXPORTED', 'INVESTIGATIONS_EXPORT_DOWNLOADED'):
        assert audits(maker, action), action


def test_backfill_uses_audit_trail_and_preserves_updated_at(seeded):
    client, maker, admin, _ = seeded
    aid = client.get('/api/investigations?page_size=1', headers=admin).json()['items'][0]['id']
    client.patch(f'/api/alerts/{aid}', headers=admin, json={'status': 'IN_REVIEW', 'assign_to_me': True})
    with maker() as db:
        a = db.get(Alert, aid)
        original, stamp = a.opened_at, a.updated_at
        db.execute(update(Alert).where(Alert.id == aid).values(opened_at=None, updated_at=stamp))
        db.commit()
        register.backfill_alert_timestamps(db)
        db.refresh(a)
        assert a.opened_at is not None and abs((a.opened_at.replace(tzinfo=None) - original.replace(tzinfo=None)).total_seconds()) < 1
        assert a.updated_at == stamp
        untouched = [x for x in db.scalars(select(Alert)) if x.status == 'OPEN']
        assert untouched and all(x.opened_at is None for x in untouched)
