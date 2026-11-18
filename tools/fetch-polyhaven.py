import json,sys,os,urllib.request
from concurrent.futures import ThreadPoolExecutor
opener=urllib.request.build_opener(); opener.addheaders=[("User-Agent","mochi3d-asset-fetch/1.0")]; urllib.request.install_opener(opener)
def one(a, res='1k'):
  try:
    d=json.load(urllib.request.urlopen(f"https://api.polyhaven.com/files/{a}"));g=d['gltf'][res]['gltf']
    os.makedirs(a,exist_ok=True); urllib.request.urlretrieve(g['url'],f"{a}/{a}.gltf")
    for p,v in g['include'].items():
      os.makedirs(os.path.dirname(f"{a}/{p}") or a,exist_ok=True); urllib.request.urlretrieve(v['url'],f"{a}/{p}")
    return a+' ok'
  except Exception as e: return a+' FAIL '+str(e)
with ThreadPoolExecutor(8) as ex:
  for r in ex.map(one, sys.argv[1:]): print(r, flush=True)
