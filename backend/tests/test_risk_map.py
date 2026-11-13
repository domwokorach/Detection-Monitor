def test_risk_map_only_returns_located_alerts_at_threshold(system):
    client, _maker, headers = system
    assert client.get('/api/risk-map').status_code == 401
    r = client.get('/api/risk-map', headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body['threshold'] == 60
    assert all(e['risk_score'] >= 60 and e['la_code'] and e['status'] != 'CLOSED' for e in body['events'])
    assert all(e['location_basis'] == 'account_local_authority' for e in body['events'])
    assert client.get('/api/risk-map?min_score=50', headers=headers).status_code == 422
