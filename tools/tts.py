"""ElevenLabs text-to-speech with character timestamps, cached so each line is paid for once.

Usage: python -I tools/tts.py "text"        -> prints the cache path
       (imported by tools/sing.py)

Reads ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID and ELEVENLABS_MODEL_ID from .env. The key is never printed.
Cache: work/tts/<hash>.json (alignment) + .mp3 (audio). Delete a file to re-generate that line.
"""
import base64, hashlib, json, os, re, sys
import requests

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CACHE = os.path.join(ROOT, 'work', 'tts')


def env():
    with open(os.path.join(ROOT, '.env'), encoding='utf8') as f:
        return {k: v.strip().strip('"') for k, v in re.findall(r'^([A-Z_]+)=(.*)$', f.read(), re.M)}


def tts(text, settings=None):
    """Returns (mp3 path, alignment dict with characters / character_start_times_seconds / character_end_times_seconds)."""
    e = env()
    settings = settings or {'stability': 0.5, 'similarity_boost': 0.8}
    key = hashlib.sha1(json.dumps([text, e['ELEVENLABS_VOICE_ID'], e['ELEVENLABS_MODEL_ID'], settings], ensure_ascii=False).encode()).hexdigest()[:16]
    os.makedirs(CACHE, exist_ok=True)
    mp3, meta = os.path.join(CACHE, key + '.mp3'), os.path.join(CACHE, key + '.json')
    if not os.path.exists(meta):
        r = requests.post(
            f'https://api.elevenlabs.io/v1/text-to-speech/{e["ELEVENLABS_VOICE_ID"]}/with-timestamps',
            headers={'xi-api-key': e['ELEVENLABS_API_KEY']},
            json={'text': text, 'model_id': e['ELEVENLABS_MODEL_ID'], 'voice_settings': settings}, timeout=120)
        if r.status_code != 200:
            raise RuntimeError(f'ElevenLabs {r.status_code}: {r.text[:300]}')
        d = r.json()
        with open(mp3, 'wb') as f:
            f.write(base64.b64decode(d['audio_base64']))
        with open(meta, 'w', encoding='utf8') as f:
            json.dump({'text': text, 'alignment': d.get('alignment'), 'normalized_alignment': d.get('normalized_alignment')}, f, ensure_ascii=False, indent=1)
    with open(meta, encoding='utf8') as f:
        return mp3, json.load(f)['alignment']


if __name__ == '__main__':
    path, al = tts(sys.argv[1])
    print(path)
    print(' '.join(f'{c}:{s:.2f}' for c, s in zip(al['characters'], al['character_start_times_seconds'])))
