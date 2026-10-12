import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const directory = mkdtempSync(path.join(tmpdir(), 'locat-range-'));
try {
  const test = path.join(directory, 'MediaRangeTest.java');
  writeFileSync(test, `import com.shaikibrahim.locat.MediaByteRange;
public class MediaRangeTest {
  static void check(String header, long length, long start, long end) {
    long[] range = MediaByteRange.parse(header, length);
    if (range == null || range[0] != start || range[1] != end) throw new AssertionError(header);
  }
  static void invalid(String header, long length) { if (MediaByteRange.parse(header, length) != null) throw new AssertionError(header); }
  public static void main(String[] args) {
    check(null, 5000000000L, 0, 4999999999L);
    check("bytes=4000000000-", 5000000000L, 4000000000L, 4999999999L);
    check("bytes=10-19", 100, 10, 19); check("bytes=90-200", 100, 90, 99);
    check("bytes=-10", 100, 90, 99); check("bytes=-200", 100, 0, 99);
    invalid("bytes=100-", 100); invalid("bytes=20-10", 100); invalid("bytes=-0", 100);
    invalid("bytes=-", 100); invalid("bytes=0-1,4-5", 100); invalid("items=0-1", 100);
    invalid("bytes=999999999999999999999-", 100); invalid(null, 0);
    System.out.println("Native long byte-range tests passed (14 cases, including >4GB offsets)");
  }
}`);
  execFileSync('javac', ['-d', directory, 'scripts/MediaByteRange.java', test], { stdio: 'inherit' });
  execFileSync('java', ['-cp', directory, 'MediaRangeTest'], { stdio: 'inherit' });
} finally { rmSync(directory, { recursive: true, force: true }); }
