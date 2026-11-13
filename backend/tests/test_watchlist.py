from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from app.models import RiskRule
from app.services.screening import drain
from app.services.rules import validate_config, RuleConfigurationError
import pytest


def tx(external_id, country='ZZ', amount='120', minutes=0):
    return dict(external_id=external_id, account_id='acct-personal-03', amount=amount, currency='GBP', direction='DEBIT',
                counterparty='Watch Co', country=country, occurred_at=(datetime.now(timezone.utc) + timedelta(minutes=minutes)).isoformat())


def test_hits_are_deduplicated_and_totals_match_buckets(system):
    client, maker, headers = system
    with maker() as db:
        drain(db, limit=500)  # screen the seeded backlog first so the baseline is stable
    empty = client.get('/api/watchlist/hits?range=24h', headers=headers).json()
    base = empty['totals']['total']
    for i in range(3):
        assert client.post('/api/transactions', json=tx(f'WL-{i}', minutes=i), headers=headers).status_code == 201
    client.post('/api/transactions', json=tx('NOT-WL', country='GB'), headers=headers)
    with maker() as db:
        drain(db, limit=100)
    data = client.get('/api/watchlist/hits?range=24h', headers=headers).json()
    assert data['totals']['total'] == base + 3
    assert sum(b['total'] for b in data['buckets']) == data['totals']['total']
    assert len(data['events']) == data['totals']['total']
    assert all(e['category'] == 'OTHER' for e in data['events'])  # no list_type configured: never guessed as sanctions/PEP
    assert data['totals']['sanctions'] == 0 and data['totals']['pep'] == 0


def test_two_watchlist_rules_on_one_transaction_count_once(system):
    client, maker, headers = system
    with maker() as db:
        existing = db.scalar(select(RiskRule).where(RiskRule.kind == 'COUNTRY_WATCHLIST'))
        db.add(RiskRule(code='WATCH_SANCTIONS', name='Sanctions', kind='COUNTRY_WATCHLIST', weight=10,
                        config={'countries': ['ZZ'], 'list_type': 'SANCTIONS'}))
        db.commit()
        drain(db, limit=500)
    before = client.get('/api/watchlist/hits?range=24h', headers=headers).json()['totals']['total']
    client.post('/api/transactions', json=tx('DUP-1'), headers=headers)
    with maker() as db:
        drain(db, limit=100)
    data = client.get('/api/watchlist/hits?range=24h', headers=headers).json()
    assert data['totals']['total'] == before + 1
    assert data['totals']['sanctions'] >= 1


def test_requires_auth_and_valid_range(system):
    client, _, headers = system
    assert client.get('/api/watchlist/hits').status_code in (401, 403)
    assert client.get('/api/watchlist/hits?range=5y', headers=headers).status_code == 422


def test_list_type_validation():
    assert validate_config('COUNTRY_WATCHLIST', {'countries': ['ir'], 'list_type': 'PEP'}) == {'countries': ['IR'], 'list_type': 'PEP'}
    with pytest.raises(RuleConfigurationError):
        validate_config('COUNTRY_WATCHLIST', {'countries': ['IR'], 'list_type': 'BOGUS'})
