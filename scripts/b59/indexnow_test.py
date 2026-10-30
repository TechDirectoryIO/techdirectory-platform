"""B59 · IndexNow request tests.  python3 -I scripts/b59/indexnow_test.py"""
import pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import indexnow as ix

K = "0123456789abcdef0123456789abcdef"
S = "https://www.techdirectory.io"
results = []
t = lambda n, c: results.append((n, bool(c)))

b = list(ix.batches([S + "/a", S + "/b", S + "/a", "https://evil.example/x", "http://www.techdirectory.io/c", S + "/c "], K))
t("One request for a small change set", len(b) == 1)
t("Body has host, key, keyLocation, urlList", set(b[0]) == {"host", "key", "keyLocation", "urlList"})
t("Key file is at the site root", b[0]["keyLocation"] == S + "/" + K + ".txt")
t("Duplicates removed, order kept", b[0]["urlList"] == [S + "/a", S + "/b", S + "/c"])
t("Other hosts and plain http dropped", all(u.startswith(S + "/") for u in b[0]["urlList"]))
big = list(ix.batches([f"{S}/p{i}" for i in range(25_001)], K))
t("25,001 URLs split 10,000 / 10,000 / 5,001", [len(x["urlList"]) for x in big] == [10_000, 10_000, 5_001])
t("Nothing sent when no URLs", list(ix.batches([], K)) == [])
for bad in ("", "short", "has space in it!"):
    try:
        list(ix.batches([S + "/a"], bad)); okk = False
    except ValueError:
        okk = True
    t(f"Bad key refused ({bad!r})", okk)
t("Key not stored in the repository", K not in pathlib.Path(ix.__file__).read_text())

f = 0
for n, ok in results:
    f += not ok
    print(f"{'PASS' if ok else 'FAIL'}  {n}")
print(f"\n{len(results) - f} of {len(results)} checks passed")
sys.exit(1 if f else 0)
