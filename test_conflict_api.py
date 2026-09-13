import requests

payload = {
    "section_id": "HDN-1",
    "start_time": "2026-09-13T04:00",
    "duration_minutes": 120,
    "station_from": "NDLS",
    "station_to": "GZB",
    "start_km": 6.4,
    "end_km": 9.7,
    "km_pole": "6/40 - 9/70"
}

try:
    r = requests.post("http://127.0.0.1:5000/api/v1/live-corridor-conflicts", json=payload, timeout=5)
    print("STATUS CODE:", r.status_code)
    print("RESPONSE JSON:", r.json())
except Exception as e:
    print("ERROR:", e)
