"""Downloads sample libraries from their original publishers into samples/<library>/.

Usage: python -I tools/fetch_samples.py iowa|philharmonia [--list]

Normally a machine pulls libraries from R2 (`node tools/assets.mjs pull samples/<lib>/`); this fetches them
from the source once, before `node tools/assets.mjs push samples/<lib>/`. Already-downloaded files are skipped.

- iowa: University of Iowa Musical Instrument Samples, post-2012 set: one file per note, chromatic,
  24-bit/96 kHz stereo AIFF. Terms: "may be downloaded and used for any projects, without restrictions."
- philharmonia: Philharmonia Orchestra sound samples (all-samples.zip, MP3). Terms: free to use in your own
  work, including commercial releases; must not be sold or made available as samples or a sampler instrument.
"""
import concurrent.futures as cf, os, re, sys, urllib.parse, zipfile
import requests

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'samples')
IOWA = 'https://theremin.music.uiowa.edu/'
PHIL = 'https://philharmonia-assets.s3-eu-west-1.amazonaws.com/uploads/2020/02/12112005/all-samples.zip'


def iowa_links():
    index = requests.get(IOWA + 'MIS.html', timeout=60).text
    links = []
    for page in sorted(set(re.findall(r'MIS-Pitches-2012/[A-Za-z0-9]+\.html', index))):
        html = requests.get(IOWA + page, timeout=60).text
        for href in re.findall(r'href="([^"]+\.aiff?)"', html, re.I):
            links.append(urllib.parse.urljoin(IOWA + page, href))
    return sorted(set(links))


def local_path(url):
    # ".../sound files/MIS Pitches - 2014/Brass/Horn/Horn.ff.C2.stereo.aif" -> samples/iowa/Brass/Horn/Horn.ff.C2.stereo.aif
    rel = urllib.parse.unquote(url).split('MIS Pitches - 2014/', 1)[1]
    return os.path.join(ROOT, 'iowa', *[p for p in rel.split('/') if p])


def fetch(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return 0
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    r = requests.get(url.replace(' ', '%20'), timeout=120)
    r.raise_for_status()
    with open(dest + '.part', 'wb') as f:
        f.write(r.content)
    os.replace(dest + '.part', dest)
    return len(r.content)


def main():
    lib = sys.argv[1]
    if lib == 'iowa':
        links = iowa_links()
        print(f'{len(links)} files')
        if '--list' in sys.argv:
            print('\n'.join(links)); return
        done = total = 0
        with cf.ThreadPoolExecutor(8) as ex:
            for n in ex.map(lambda u: fetch(u, local_path(u)), links):
                done += 1; total += n
                if done % 200 == 0:
                    print(f'  {done}/{len(links)}, {total / 1e6:.0f} MB new')
        print(f'done: {total / 1e6:.0f} MB downloaded')
    elif lib == 'philharmonia':
        dest = os.path.join(ROOT, 'philharmonia')
        zpath = os.path.join(dest, 'all-samples.zip')
        os.makedirs(dest, exist_ok=True)
        if os.path.isdir(os.path.join(dest, 'violin')):
            print('philharmonia: already unpacked'); return
        if not os.path.exists(zpath):
            with requests.get(PHIL, stream=True, timeout=120) as r, open(zpath + '.part', 'wb') as f:
                r.raise_for_status()
                for chunk in r.iter_content(1 << 20):
                    f.write(chunk)
            os.replace(zpath + '.part', zpath)
        # The archive nests one zip per instrument; unpack all levels, refusing paths that escape the folder.
        # __MACOSX/ holds macOS resource forks named like the zips ("._violin.zip"), which are not archives.
        def unpack(zp, into):
            with zipfile.ZipFile(zp) as z:
                names = [m for m in z.namelist() if not m.startswith('__MACOSX/')]
                for m in names:
                    target = os.path.realpath(os.path.join(into, m))
                    if not target.startswith(os.path.realpath(into)):
                        raise ValueError(f'unsafe path in {zp}: {m}')
                z.extractall(into, names)
            for dirpath, _, files in os.walk(into):
                for fn in files:
                    if fn.lower().endswith('.zip') and os.path.join(dirpath, fn) != zpath:
                        inner = os.path.join(dirpath, fn)
                        unpack(inner, os.path.splitext(inner)[0])
                        os.remove(inner)
        unpack(zpath, dest)
        # samples/philharmonia/all-samples/<instrument>/ -> samples/philharmonia/<instrument>/
        inner = os.path.join(dest, 'all-samples')
        for d in os.listdir(inner):
            os.replace(os.path.join(inner, d), os.path.join(dest, d))
        os.rmdir(inner)
        os.remove(zpath)
        n = sum(len(f) for _, _, f in os.walk(dest))
        print(f'philharmonia: {n} files in {dest}')
    else:
        sys.exit(__doc__)


if __name__ == '__main__':
    main()
