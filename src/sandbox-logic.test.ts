/**
 * Tests for sandbox permission logic.
 *
 * Tests pure functions and regex patterns used in sandbox-preload.js
 * and main.ts for permission management.
 */
import { describe, it, expect } from "vitest";
import path from "path";

// ── likelyNeedsElevation heuristic ──
// Reimplemented here since it's a private function in main.ts.
// If this logic changes in main.ts, update these tests accordingly.
function likelyNeedsElevation(dir: string): boolean {
  const norm = path.resolve(dir).toLowerCase();
  const parts = norm.split(path.sep).filter(Boolean);
  if (parts.length <= 1) return true;
  const topDir = parts[1];
  const systemDirs = ["users", "windows", "program files", "program files (x86)", "programdata"];
  if (parts.length === 2 && systemDirs.includes(topDir)) return true;
  if (parts.length === 3 && topDir === "users") return true;
  return false;
}

describe("likelyNeedsElevation", () => {
  it("drive root needs elevation", () => {
    expect(likelyNeedsElevation("C:\\")).toBe(true);
    expect(likelyNeedsElevation("D:\\")).toBe(true);
  });

  it("C:\\Users needs elevation", () => {
    expect(likelyNeedsElevation("C:\\Users")).toBe(true);
  });

  it("C:\\Windows needs elevation", () => {
    expect(likelyNeedsElevation("C:\\Windows")).toBe(true);
  });

  it("C:\\Program Files needs elevation", () => {
    expect(likelyNeedsElevation("C:\\Program Files")).toBe(true);
  });

  it("C:\\ProgramData needs elevation", () => {
    expect(likelyNeedsElevation("C:\\ProgramData")).toBe(true);
  });

  it("user profile directory needs elevation (inheritance protected)", () => {
    expect(likelyNeedsElevation("C:\\Users\\someone")).toBe(true);
  });

  it("subdirectory of user profile does NOT need elevation", () => {
    expect(likelyNeedsElevation("C:\\Users\\someone\\Documents")).toBe(false);
  });

  it("custom top-level directory does NOT need elevation", () => {
    expect(likelyNeedsElevation("C:\\MyData")).toBe(false);
    expect(likelyNeedsElevation("C:\\a")).toBe(false);
    expect(likelyNeedsElevation("D:\\projects")).toBe(false);
  });

  it("deep path does NOT need elevation", () => {
    expect(likelyNeedsElevation("C:\\Users\\someone\\Desktop\\folder")).toBe(false);
  });
});

// ── isNonFilePath (named pipes, device paths) ──
// Reimplemented from sandbox-preload.js
function isNonFilePath(p: string): boolean {
  const s = String(p);
  if (s.indexOf('\\\\.\\') === 0 || s.indexOf('\\\\?\\') === 0) return true;
  if (/^\\\\[.?]\\/.test(s)) return true;
  return false;
}

describe("isNonFilePath", () => {
  it("detects named pipes", () => {
    expect(isNonFilePath("\\\\.\\pipe\\conpty-12345-in")).toBe(true);
    expect(isNonFilePath("\\\\.\\pipe\\somepipe")).toBe(true);
  });

  it("detects device paths", () => {
    expect(isNonFilePath("\\\\.\\PhysicalDrive0")).toBe(true);
    expect(isNonFilePath("\\\\?\\Volume{guid}")).toBe(true);
  });

  it("does not match normal file paths", () => {
    expect(isNonFilePath("C:\\Users\\test")).toBe(false);
    expect(isNonFilePath("D:\\data\\file.txt")).toBe(false);
    expect(isNonFilePath("\\\\server\\share")).toBe(false);
  });

  it("does not match empty or short strings", () => {
    expect(isNonFilePath("")).toBe(false);
    expect(isNonFilePath("C:")).toBe(false);
  });
});

// ── Python Access Denied pattern ──
// Tests the regex added to PATH_EXTRACT_PATTERNS in sandbox-preload.js
const PYTHON_ACCESS_DENIED_RE = /access is denied:\s+['\u2018\u2019]([a-zA-Z]:\\[^'\u2018\u2019]*)['\u2018\u2019]/i;

describe("Python Access Denied pattern", () => {
  it("matches standard Python PermissionError format", () => {
    const output = "PermissionError: [WinError 5] Access is denied: 'C:\\b'";
    const m = output.match(PYTHON_ACCESS_DENIED_RE);
    expect(m).not.toBeNull();
    expect(m![1]).toBe("C:\\b");
  });

  it("matches path with spaces", () => {
    const output = "Access is denied: 'C:\\Program Files\\data'";
    const m = output.match(PYTHON_ACCESS_DENIED_RE);
    expect(m).not.toBeNull();
    expect(m![1]).toBe("C:\\Program Files\\data");
  });

  it("matches path with deep nesting", () => {
    const output = "Access is denied: 'D:\\projects\\work\\secret\\file.txt'";
    const m = output.match(PYTHON_ACCESS_DENIED_RE);
    expect(m).not.toBeNull();
    expect(m![1]).toBe("D:\\projects\\work\\secret\\file.txt");
  });

  it("matches Unicode left/right single quotes", () => {
    const output = "Access is denied: \u2018C:\\data\u2019";
    const m = output.match(PYTHON_ACCESS_DENIED_RE);
    expect(m).not.toBeNull();
    expect(m![1]).toBe("C:\\data");
  });

  it("does not match non-Windows paths", () => {
    const output = "Access is denied: '/tmp/data'";
    const m = output.match(PYTHON_ACCESS_DENIED_RE);
    expect(m).toBeNull();
  });

  it("is case insensitive", () => {
    const output = "ACCESS IS DENIED: 'C:\\test'";
    const m = output.match(PYTHON_ACCESS_DENIED_RE);
    expect(m).not.toBeNull();
    expect(m![1]).toBe("C:\\test");
  });
});

// ── handlePermissionDecision ──
// Reimplemented from sandbox-preload.js
function handlePermissionDecision(
  decision: string, roDir: string, isWrite: boolean,
  readCache: Record<string, number>, writeCache: Record<string, number>,
  denySet: Set<string>
): boolean {
  const now = Date.now();
  if (decision === 'allow-once') {
    if (isWrite) writeCache[roDir] = now + 5000;
    else readCache[roDir] = now + 5000;
    return false;
  } else if (decision === 'grant-rw') {
    writeCache[roDir] = Infinity;
    return false;
  } else if (decision === 'grant-ro') {
    if (isWrite) {
      denySet.add(roDir);
      return true;
    }
    readCache[roDir] = Infinity;
    return false;
  } else {
    denySet.add(roDir);
    return true;
  }
}

describe("handlePermissionDecision", () => {
  it("grant-rw allows both read and write", () => {
    const rc: Record<string, number> = {};
    const wc: Record<string, number> = {};
    const ds = new Set<string>();
    expect(handlePermissionDecision("grant-rw", "c:\\a\\", false, rc, wc, ds)).toBe(false);
    expect(wc["c:\\a\\"]).toBe(Infinity);
    expect(handlePermissionDecision("grant-rw", "c:\\b\\", true, rc, wc, ds)).toBe(false);
    expect(wc["c:\\b\\"]).toBe(Infinity);
  });

  it("grant-ro allows read but blocks write", () => {
    const rc: Record<string, number> = {};
    const wc: Record<string, number> = {};
    const ds = new Set<string>();
    expect(handlePermissionDecision("grant-ro", "c:\\a\\", false, rc, wc, ds)).toBe(false);
    expect(rc["c:\\a\\"]).toBe(Infinity);
    expect(handlePermissionDecision("grant-ro", "c:\\b\\", true, rc, wc, ds)).toBe(true);
    expect(ds.has("c:\\b\\")).toBe(true);
  });

  it("allow-once sets short TTL", () => {
    const rc: Record<string, number> = {};
    const wc: Record<string, number> = {};
    const ds = new Set<string>();
    expect(handlePermissionDecision("allow-once", "c:\\a\\", false, rc, wc, ds)).toBe(false);
    expect(rc["c:\\a\\"]).toBeGreaterThan(Date.now());
    expect(rc["c:\\a\\"]).toBeLessThan(Date.now() + 10000);
  });

  it("deny blocks and adds to deny set", () => {
    const rc: Record<string, number> = {};
    const wc: Record<string, number> = {};
    const ds = new Set<string>();
    expect(handlePermissionDecision("deny", "c:\\a\\", false, rc, wc, ds)).toBe(true);
    expect(ds.has("c:\\a\\")).toBe(true);
  });
});

// ── findRestrictedDir logic ──
// Tests the heuristic for determining which directory to show in permission dialog
describe("findRestrictedDir heuristic", () => {
  // Reimplemented from sandbox-state.js (no-RO-match fallback path)
  function findRestrictedDir(resolvedLower: string): string {
    const hasExt = /\.[a-z0-9]{1,10}$/i.test(resolvedLower);
    let dir: string;
    if (hasExt) {
      dir = path.dirname(resolvedLower);
    } else {
      dir = resolvedLower;
    }
    if (dir[dir.length - 1] !== path.sep) dir += path.sep;
    if (/^[a-z]:\\$/i.test(dir)) {
      let asDir = resolvedLower;
      if (asDir[asDir.length - 1] !== path.sep) asDir += path.sep;
      return asDir;
    }
    return dir;
  }

  it("directory path returns path with trailing sep", () => {
    expect(findRestrictedDir("c:\\users\\hasu")).toBe("c:\\users\\hasu\\");
  });

  it("file path returns parent directory", () => {
    expect(findRestrictedDir("c:\\users\\hasu\\file.txt")).toBe("c:\\users\\hasu\\");
  });

  it("drive root stays as drive root", () => {
    const result = findRestrictedDir("c:");
    expect(result).toBe("c:\\");
  });

  it("extensionless file treated as directory", () => {
    expect(findRestrictedDir("c:\\data\\myfile")).toBe("c:\\data\\myfile\\");
  });

  it("deeply nested file goes to parent", () => {
    expect(findRestrictedDir("c:\\a\\b\\c\\d.log")).toBe("c:\\a\\b\\c\\");
  });
});

describe("findRestrictedDir with RO dirs", () => {
  // Full reimplementation including RO dir matching
  function findRestrictedDirFull(resolvedLower: string, roDirs: string[]): string {
    let best = "";
    for (const ro of roDirs) {
      if ((resolvedLower === ro.slice(0, -1) || resolvedLower.indexOf(ro) === 0) && ro.length > best.length) best = ro;
    }
    const hasExt = /\.[a-z0-9]{1,10}$/i.test(resolvedLower);
    let dir: string = hasExt ? path.dirname(resolvedLower) : resolvedLower;
    if (dir[dir.length - 1] !== path.sep) dir += path.sep;
    if (best) {
      if (dir === best) return best;
      return dir;
    }
    if (/^[a-z]:\\$/i.test(dir)) {
      let asDir = resolvedLower;
      if (asDir[asDir.length - 1] !== path.sep) asDir += path.sep;
      return asDir;
    }
    return dir;
  }

  it("file in subdirectory of RO dir → returns file's parent (not RO root)", () => {
    // c:\a is RO, file is c:\a\b\test.txt → grant target should be c:\a\b\ (not c:\a\)
    expect(findRestrictedDirFull("c:\\a\\b\\test.txt", ["c:\\a\\"])).toBe("c:\\a\\b\\");
  });

  it("file directly in RO dir → returns the RO dir", () => {
    // c:\a is RO, file is c:\a\test.txt → grant target is c:\a\ (the RO dir itself)
    expect(findRestrictedDirFull("c:\\a\\test.txt", ["c:\\a\\"])).toBe("c:\\a\\");
  });

  it("directory in RO dir → returns that directory (not RO root)", () => {
    expect(findRestrictedDirFull("c:\\a\\b", ["c:\\a\\"])).toBe("c:\\a\\b\\");
  });

  it("directory that IS the RO dir → returns the RO dir", () => {
    expect(findRestrictedDirFull("c:\\a", ["c:\\a\\"])).toBe("c:\\a\\");
  });

  it("deeply nested file → returns immediate parent", () => {
    expect(findRestrictedDirFull("c:\\data\\x\\y\\z\\file.log", ["c:\\data\\"])).toBe("c:\\data\\x\\y\\z\\");
  });

  it("most specific RO dir is matched first", () => {
    // Both c:\a\ and c:\a\b\ are RO — file's parent is returned (not either RO dir)
    expect(findRestrictedDirFull("c:\\a\\b\\c\\file.txt", ["c:\\a\\", "c:\\a\\b\\"])).toBe("c:\\a\\b\\c\\");
  });

  it("file parent equals deeper RO dir → returns the RO dir", () => {
    expect(findRestrictedDirFull("c:\\a\\b\\file.txt", ["c:\\a\\", "c:\\a\\b\\"])).toBe("c:\\a\\b\\");
  });

  it("no RO dir match → falls through to default heuristic", () => {
    expect(findRestrictedDirFull("c:\\other\\file.txt", ["c:\\a\\"])).toBe("c:\\other\\");
  });
});

// ── inferAccessNeeded ──
// Import from sandbox-permission.js (CommonJS)
const perm = require("../../appcontainer/sandbox-permission.js");
const inferAccessNeeded = perm.inferAccessNeeded;

describe("inferAccessNeeded", () => {
  describe("simple commands (no shell prefix)", () => {
    it("ls → ro", () => {
      expect(inferAccessNeeded("ls C:\\data")).toBe("ro");
    });

    it("dir → ro", () => {
      expect(inferAccessNeeded("dir C:\\Users\\test")).toBe("ro");
    });

    it("Get-ChildItem → ro", () => {
      expect(inferAccessNeeded("Get-ChildItem C:\\a")).toBe("ro");
    });

    it("gci → ro", () => {
      expect(inferAccessNeeded("gci C:\\temp")).toBe("ro");
    });

    it("Get-Content → ro", () => {
      expect(inferAccessNeeded("Get-Content C:\\a\\file.txt")).toBe("ro");
    });

    it("cat → ro", () => {
      expect(inferAccessNeeded("cat C:\\logs\\app.log")).toBe("ro");
    });

    it("type → ro", () => {
      expect(inferAccessNeeded("type C:\\readme.txt")).toBe("ro");
    });

    it("unknown command → rw", () => {
      expect(inferAccessNeeded("myapp C:\\data")).toBe("rw");
    });

    it("empty → rw", () => {
      expect(inferAccessNeeded("")).toBe("rw");
    });

    it("null → rw", () => {
      expect(inferAccessNeeded(null)).toBe("rw");
    });
  });

  describe("with shell prefix (short name)", () => {
    it("pwsh -Command ls → ro", () => {
      expect(inferAccessNeeded("pwsh -NoProfile -Command ls C:\\data")).toBe("ro");
    });

    it("powershell -Command dir → ro", () => {
      expect(inferAccessNeeded("powershell -Command dir C:\\a")).toBe("ro");
    });

    it("cmd /c dir → ro", () => {
      expect(inferAccessNeeded("cmd /c dir C:\\a")).toBe("ro");
    });

    it("cmd.exe /d /s /c type → ro", () => {
      expect(inferAccessNeeded("cmd.exe /d /s /c type C:\\readme.txt")).toBe("ro");
    });
  });

  describe("with full-path shell prefix (regression)", () => {
    it("C:\\...\\pwsh.exe -Command ls → ro", () => {
      expect(inferAccessNeeded(
        'C:\\Program Files\\PowerShell\\7\\pwsh.exe -NoProfile -NonInteractive -Command ls "C:\\Users\\hasu\\OneDrive - Microsoft\\Documents"'
      )).toBe("ro");
    });

    it("C:\\Windows\\System32\\cmd.exe /c dir → ro", () => {
      expect(inferAccessNeeded(
        "C:\\Windows\\System32\\cmd.exe /c dir C:\\a"
      )).toBe("ro");
    });

    it("C:\\...\\powershell.exe -Command Get-ChildItem → ro", () => {
      expect(inferAccessNeeded(
        "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe -Command Get-ChildItem C:\\data"
      )).toBe("ro");
    });

    it("C:\\...\\pwsh.exe -Command Remove-Item → rw", () => {
      expect(inferAccessNeeded(
        'C:\\Program Files\\PowerShell\\7\\pwsh.exe -Command Remove-Item "C:\\temp\\old.txt"'
      )).toBe("rw");
    });
  });

  describe("write detection", () => {
    it("Out-File → rw", () => {
      expect(inferAccessNeeded('ls | Out-File "C:\\output.txt"')).toBe("rw");
    });

    it("redirect > → rw", () => {
      expect(inferAccessNeeded("dir > C:\\output.txt")).toBe("rw");
    });

    it("Set-Content → rw (piped)", () => {
      expect(inferAccessNeeded('"hello" | Set-Content C:\\file.txt')).toBe("rw");
    });

    it("icacls with /grant → rw", () => {
      expect(inferAccessNeeded("icacls C:\\a /grant Users:F")).toBe("rw");
    });

    it("icacls read-only → ro", () => {
      expect(inferAccessNeeded("icacls C:\\a")).toBe("ro");
    });
  });
});

// ── classifyAuthLevel ──
// Determines whether a resolved path is in RW dirs, RO dirs, or neither.
// This drives the permission dialog behavior when Access Denied is detected
// after command execution:
//   "rw"   → silent retry (ACL propagation wait)
//   "ro"   → prompt for RW upgrade
//   "none" → prompt for initial permission

const cpHooks = require("../../appcontainer/sandbox-cp-hooks.js");
const classifyAuthLevel = cpHooks.classifyAuthLevel;

describe("classifyAuthLevel", () => {
  const rwDirs = [
    "c:\\users\\admin\\.openclaw\\",
    "c:\\projects\\myapp\\",
  ];
  const roDirs = [
    "c:\\users\\admin\\desktop\\",
    "c:\\users\\admin\\documents\\",
  ];

  describe("RW-authorized paths", () => {
    it("exact match (without trailing sep) → rw", () => {
      expect(classifyAuthLevel("c:\\users\\admin\\.openclaw", rwDirs, roDirs)).toBe("rw");
    });

    it("child path → rw", () => {
      expect(classifyAuthLevel("c:\\users\\admin\\.openclaw\\workspace\\file.txt", rwDirs, roDirs)).toBe("rw");
    });

    it("exact dir with trailing sep already stripped → rw", () => {
      expect(classifyAuthLevel("c:\\projects\\myapp", rwDirs, roDirs)).toBe("rw");
    });

    it("subdirectory of RW dir → rw", () => {
      expect(classifyAuthLevel("c:\\projects\\myapp\\src\\index.ts", rwDirs, roDirs)).toBe("rw");
    });
  });

  describe("RO-authorized paths", () => {
    it("exact match (without trailing sep) → ro", () => {
      expect(classifyAuthLevel("c:\\users\\admin\\desktop", rwDirs, roDirs)).toBe("ro");
    });

    it("child path → ro", () => {
      expect(classifyAuthLevel("c:\\users\\admin\\desktop\\file.txt", rwDirs, roDirs)).toBe("ro");
    });

    it("documents subfolder → ro", () => {
      expect(classifyAuthLevel("c:\\users\\admin\\documents\\report.docx", rwDirs, roDirs)).toBe("ro");
    });
  });

  describe("unauthorized paths", () => {
    it("completely unrelated path → none", () => {
      expect(classifyAuthLevel("d:\\data\\files", rwDirs, roDirs)).toBe("none");
    });

    it("parent of authorized dir → none", () => {
      expect(classifyAuthLevel("c:\\users\\admin", rwDirs, roDirs)).toBe("none");
    });

    it("sibling of authorized dir → none", () => {
      expect(classifyAuthLevel("c:\\users\\admin\\downloads\\file.zip", rwDirs, roDirs)).toBe("none");
    });
  });

  describe("RW takes precedence over RO", () => {
    it("path in both RW and RO → rw wins", () => {
      // If a path is somehow in both lists, RW check runs first
      const bothRW = ["c:\\shared\\"];
      const bothRO = ["c:\\shared\\"];
      expect(classifyAuthLevel("c:\\shared\\file.txt", bothRW, bothRO)).toBe("rw");
    });
  });

  describe("edge cases", () => {
    it("empty dirs lists → none", () => {
      expect(classifyAuthLevel("c:\\anything", [], [])).toBe("none");
    });

    it("drive root path → matches if drive root is in list", () => {
      expect(classifyAuthLevel("c:\\", ["c:\\"], [])).toBe("rw");
    });

    it("path prefix collision (c:\\usersXYZ vs c:\\users\\) → none", () => {
      // "c:\\usersXYZ" should NOT match "c:\\users\\" — indexOf would find it
      // but the dir entry has trailing sep, so startsWith check should work
      const dirs = ["c:\\users\\"];
      // "c:\\usersxyz".indexOf("c:\\users\\") === -1 because of the backslash
      expect(classifyAuthLevel("c:\\usersxyz", [], dirs)).toBe("none");
    });
  });
});

// ── RO→RW upgrade scenario (integration-level description) ──

describe("RO-to-RW upgrade scenario", () => {
  it("Desktop with RO auth: classifyAuthLevel returns 'ro' for write attempts", () => {
    const rwDirs: string[] = [];
    const roDirs = ["c:\\users\\administrator\\desktop\\"];

    // When Move-Item fails with Access Denied on Desktop...
    const level = classifyAuthLevel("c:\\users\\administrator\\desktop\\somefolder", rwDirs, roDirs);
    // classifyAuthLevel should return "ro", meaning:
    // → handleAsyncAccessDenied will trigger RW upgrade dialog (not silent retry)
    expect(level).toBe("ro");
  });

  it("Desktop with RW auth: classifyAuthLevel returns 'rw' for access denied", () => {
    const rwDirs = ["c:\\users\\administrator\\desktop\\"];
    const roDirs: string[] = [];

    // When command fails with Access Denied but Desktop has RW...
    const level = classifyAuthLevel("c:\\users\\administrator\\desktop\\somefolder", rwDirs, roDirs);
    // classifyAuthLevel should return "rw", meaning:
    // → handleAsyncAccessDenied will do silent ACL propagation retry
    expect(level).toBe("rw");
  });

  it("Desktop with no auth: classifyAuthLevel returns 'none'", () => {
    const rwDirs: string[] = [];
    const roDirs: string[] = [];

    const level = classifyAuthLevel("c:\\users\\administrator\\desktop\\somefolder", rwDirs, roDirs);
    // → handleAsyncAccessDenied will send normal permission request
    expect(level).toBe("none");
  });
});

// ── ensureUtf8Args ──
// Injects UTF-8 encoding directives into shell command args so child
// processes inside AppContainer output UTF-8 instead of the system OEM code page.

const { ensureUtf8Args } = cpHooks;

describe("ensureUtf8Args", () => {
  describe("cmd.exe", () => {
    it("injects chcp 65001 after /c flag", () => {
      const result = ensureUtf8Args("C:\\Windows\\System32\\cmd.exe", ["/c", "dir C:\\a"]);
      expect(result).toEqual(["/c", "chcp 65001 >nul &", "dir C:\\a"]);
    });

    it("injects chcp 65001 after /C (case-insensitive)", () => {
      const result = ensureUtf8Args("cmd.exe", ["/C", "echo hello"]);
      expect(result).toEqual(["/C", "chcp 65001 >nul &", "echo hello"]);
    });

    it("injects chcp 65001 after /k flag", () => {
      const result = ensureUtf8Args("cmd.exe", ["/k", "dir"]);
      expect(result).toEqual(["/k", "chcp 65001 >nul &", "dir"]);
    });

    it("does not modify args without /c or /k", () => {
      const result = ensureUtf8Args("cmd.exe", ["/d", "/s"]);
      expect(result).toEqual(["/d", "/s"]);
    });

    it("does not modify original array", () => {
      const original = ["/c", "dir"];
      ensureUtf8Args("cmd.exe", original);
      expect(original).toEqual(["/c", "dir"]);
    });

    it("handles cmd without .exe extension", () => {
      const result = ensureUtf8Args("cmd", ["/c", "dir"]);
      expect(result).toEqual(["/c", "chcp 65001 >nul &", "dir"]);
    });
  });

  describe("pwsh.exe / powershell.exe", () => {
    it("injects OutputEncoding after -Command flag for pwsh", () => {
      const result = ensureUtf8Args("pwsh.exe", ["-NoProfile", "-Command", "Get-ChildItem"]);
      expect(result[0]).toBe("-NoProfile");
      expect(result[1]).toBe("-Command");
      expect(result[2]).toContain("[Console]::OutputEncoding");
      expect(result[3]).toBe("Get-ChildItem");
    });

    it("injects OutputEncoding after -c shorthand", () => {
      const result = ensureUtf8Args("pwsh.exe", ["-c", "ls"]);
      expect(result).toEqual([
        "-c",
        "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8;",
        "ls",
      ]);
    });

    it("works with powershell.exe", () => {
      const result = ensureUtf8Args("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe", ["-Command", "dir"]);
      expect(result[1]).toContain("[Console]::OutputEncoding");
    });

    it("case-insensitive -Command match", () => {
      const result = ensureUtf8Args("pwsh.exe", ["-command", "echo hi"]);
      expect(result.length).toBe(3);
      expect(result[1]).toContain("UTF8");
    });

    it("does not modify args without -Command/-c", () => {
      const result = ensureUtf8Args("pwsh.exe", ["-File", "script.ps1"]);
      expect(result).toEqual(["-File", "script.ps1"]);
    });
  });

  describe("non-shell executables", () => {
    it("returns args unchanged for node.exe", () => {
      const result = ensureUtf8Args("node.exe", ["script.js", "--flag"]);
      expect(result).toEqual(["script.js", "--flag"]);
    });

    it("returns args unchanged for python.exe", () => {
      const result = ensureUtf8Args("python.exe", ["-c", "print('hi')"]);
      expect(result).toEqual(["-c", "print('hi')"]);
    });

    it("returns empty array for empty args", () => {
      const result = ensureUtf8Args("cmd.exe", []);
      expect(result).toEqual([]);
    });
  });
});

// ── UTF-8 Chinese output integration tests ──
// Verify that child processes produce correct Chinese characters when
// decoded as UTF-8. The real sandbox pipeline uses AppContainerLauncher (C#)
// which sets Console.OutputEncoding = UTF8; here we simulate the same effect
// by spawning Node.js subprocesses that output known UTF-8 text.

import { spawnSync } from "child_process";

describe("UTF-8 Chinese output (integration)", () => {
  const CHINESE_TEXT = "你好世界";

  describe("Node.js subprocess via cmd.exe", () => {
    it("outputs correct Chinese through cmd.exe with chcp 65001", () => {
      // ensureUtf8Args injects "chcp 65001 >nul &" as a separate arg element,
      // which AppContainerLauncher reassembles into the command line.
      // Here we simulate the same by joining args after /c into one string.
      // Use a temp script file to avoid cmd.exe quote-nesting issues.
      const fs = require("fs");
      const os = require("os");
      const path = require("path");
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "utf8test-"));
      const script = path.join(tmpDir, "emit.js");
      fs.writeFileSync(script, `process.stdout.write('${CHINESE_TEXT}')`, "utf-8");
      try {
        const args = ensureUtf8Args("cmd.exe", ["/c", `node ${script}`]);
        const flagIdx = args.findIndex((a: string) => /^\/[ck]$/i.test(a));
        const combined = [
          ...args.slice(0, flagIdx + 1),
          args.slice(flagIdx + 1).join(" "),
        ];
        const result = spawnSync("cmd.exe", combined, {
          windowsHide: true,
          timeout: 10000,
        });
        expect(result.stdout.toString("utf-8")).toContain(CHINESE_TEXT);
      } finally {
        fs.unlinkSync(script);
        fs.rmdirSync(tmpDir);
      }
    });

    it("args are correctly transformed by ensureUtf8Args", () => {
      const nodeCmd = `node -e "console.log('test')"`;
      const args = ensureUtf8Args("cmd.exe", ["/c", nodeCmd]);
      // Should have chcp 65001 injected before the actual command
      expect(args.some((a: string) => a.includes("chcp 65001"))).toBe(true);
      expect(args.some((a: string) => a.includes("node"))).toBe(true);
    });
  });

  describe("pwsh.exe with OutputEncoding=UTF8", () => {
    it("Write-Output outputs correct Chinese", () => {
      const args = ensureUtf8Args("pwsh.exe", [
        "-NoProfile",
        "-Command",
        `Write-Output '${CHINESE_TEXT}'`,
      ]);
      const result = spawnSync("pwsh.exe", args, {
        encoding: "utf-8",
        windowsHide: true,
        timeout: 10000,
      });
      // Skip if pwsh not available
      if (result.error) return;
      expect(result.stdout).toContain(CHINESE_TEXT);
    });

    it("args include OutputEncoding directive", () => {
      const args = ensureUtf8Args("pwsh.exe", ["-Command", "Get-Date"]);
      expect(
        args.some((a: string) => a.includes("OutputEncoding"))
      ).toBe(true);
    });
  });

  describe("Buffer.toString('utf-8') decoding", () => {
    it("decodes Chinese UTF-8 bytes correctly", () => {
      // "你好" in UTF-8: E4BDA0 E5A5BD
      const buf = Buffer.from([0xe4, 0xbd, 0xa0, 0xe5, 0xa5, 0xbd]);
      expect(buf.toString("utf-8")).toBe("你好");
    });

    it("decodes mixed ASCII + Chinese UTF-8 bytes", () => {
      // "Hello你好" in UTF-8
      const buf = Buffer.from([
        0x48, 0x65, 0x6c, 0x6c, 0x6f, // "Hello"
        0xe4, 0xbd, 0xa0,             // "你"
        0xe5, 0xa5, 0xbd,             // "好"
      ]);
      expect(buf.toString("utf-8")).toBe("Hello你好");
    });

    it("Node.js subprocess raw Buffer decoded as utf-8", () => {
      // Spawn node that outputs Chinese, read raw Buffer, decode as UTF-8
      const result = spawnSync(
        "node",
        ["-e", `process.stdout.write('${CHINESE_TEXT}')`],
        { windowsHide: true, timeout: 5000 }
      );
      expect(result.stdout.toString("utf-8")).toBe(CHINESE_TEXT);
    });
  });
});

// ── isSubdirectoryOf ──
// Reimplemented from main.ts
function isSubdirectoryOf(parentDir: string, childDir: string): boolean {
  const normalParent = path.resolve(parentDir).toLowerCase();
  const normalChild = path.resolve(childDir).toLowerCase();
  if (normalParent === normalChild) return false;
  const parentWithSep = normalParent.endsWith(path.sep) ? normalParent : normalParent + path.sep;
  return normalChild.startsWith(parentWithSep);
}

describe("isSubdirectoryOf", () => {
  it("child is a subdirectory of parent", () => {
    expect(isSubdirectoryOf("C:\\Data", "C:\\Data\\Sub")).toBe(true);
    expect(isSubdirectoryOf("C:\\Data", "C:\\Data\\Sub\\Deep")).toBe(true);
  });

  it("same directory is NOT a subdirectory", () => {
    expect(isSubdirectoryOf("C:\\Data", "C:\\Data")).toBe(false);
  });

  it("sibling directory is NOT a subdirectory", () => {
    expect(isSubdirectoryOf("C:\\Data", "C:\\DataOther")).toBe(false);
    expect(isSubdirectoryOf("C:\\Data", "C:\\DataSuffix")).toBe(false);
  });

  it("parent of parent is NOT a subdirectory", () => {
    expect(isSubdirectoryOf("C:\\Data\\Sub", "C:\\Data")).toBe(false);
  });

  it("case insensitive", () => {
    expect(isSubdirectoryOf("C:\\DATA", "c:\\data\\sub")).toBe(true);
  });

  it("drive root as parent", () => {
    expect(isSubdirectoryOf("C:\\", "C:\\Data")).toBe(true);
    expect(isSubdirectoryOf("C:\\", "C:\\")).toBe(false);
  });

  it("handles trailing separators", () => {
    expect(isSubdirectoryOf("C:\\Data\\", "C:\\Data\\Sub")).toBe(true);
    expect(isSubdirectoryOf("C:\\Data", "C:\\Data\\Sub\\")).toBe(true);
  });
});

// ── hasExplicitSidAce ──
// Reimplemented from main.ts — parses icacls output for explicit vs inherited ACEs
function hasExplicitSidAce(icaclsOutput: string, sid: string): boolean {
  const lines = icaclsOutput.split(/\r?\n/);
  for (const line of lines) {
    const sidIdx = line.indexOf(sid);
    if (sidIdx < 0) continue;
    const afterSid = line.substring(sidIdx + sid.length);
    if (!/\(I\)/.test(afterSid)) return true;
  }
  return false;
}

describe("hasExplicitSidAce", () => {
  const SID = "S-1-15-2-12345";

  it("detects explicit ACE (no (I) flag)", () => {
    const output = `C:\\Data ${SID}:(OI)(CI)(M)\n`;
    expect(hasExplicitSidAce(output, SID)).toBe(true);
  });

  it("returns false when only inherited ACEs exist", () => {
    const output = `C:\\Data ${SID}:(I)(OI)(CI)(RX)\n`;
    expect(hasExplicitSidAce(output, SID)).toBe(false);
  });

  it("detects explicit when both explicit and inherited exist", () => {
    const output = `C:\\Data ${SID}:(OI)(CI)(M)\n            ${SID}:(I)(OI)(CI)(RX)\n`;
    expect(hasExplicitSidAce(output, SID)).toBe(true);
  });

  it("returns false when SID not in output", () => {
    const output = "C:\\Data BUILTIN\\Users:(OI)(CI)(RX)\n";
    expect(hasExplicitSidAce(output, SID)).toBe(false);
  });

  it("handles multiple inherited entries", () => {
    const output = `C:\\Data ${SID}:(I)(OI)(CI)(RX)\n            ${SID}:(I)(OI)(CI)(R)\n`;
    expect(hasExplicitSidAce(output, SID)).toBe(false);
  });
});

// ── Parent/child directory interaction in isBlockedPath ──
// Tests the "most specific match wins" logic in sandbox-state.js
describe("parent/child directory permission interaction", () => {
  // Reimplemented from sandbox-state.js isBlockedPath logic
  function isBlockedPath(filePath: string, rwDirs: string[], roDirs: string[]): boolean {
    const resolved = path.resolve(String(filePath)).toLowerCase();
    let rwMatchLen = 0;
    for (const rw of rwDirs) {
      if ((resolved === rw.slice(0, -1) || resolved.indexOf(rw) === 0) && rw.length > rwMatchLen) {
        rwMatchLen = rw.length;
      }
    }
    let roMatchLen = 0;
    for (const ro of roDirs) {
      if ((resolved === ro.slice(0, -1) || resolved.indexOf(ro) === 0) && ro.length > roMatchLen) {
        roMatchLen = ro.length;
      }
    }
    if (rwMatchLen > 0 && rwMatchLen > roMatchLen) return false;
    return true;
  }

  it("parent RO, child RW: file under child is NOT blocked (RW wins)", () => {
    const roDirs = ["c:\\data\\"];
    const rwDirs = ["c:\\data\\sub\\"];
    expect(isBlockedPath("C:\\Data\\Sub\\file.txt", rwDirs, roDirs)).toBe(false);
  });

  it("parent RO, child RW: file directly under parent IS blocked (RO)", () => {
    const roDirs = ["c:\\data\\"];
    const rwDirs = ["c:\\data\\sub\\"];
    expect(isBlockedPath("C:\\Data\\file.txt", rwDirs, roDirs)).toBe(true);
  });

  it("parent RO, child RW: child dir itself is NOT blocked", () => {
    const roDirs = ["c:\\data\\"];
    const rwDirs = ["c:\\data\\sub\\"];
    expect(isBlockedPath("C:\\Data\\Sub", rwDirs, roDirs)).toBe(false);
  });

  it("parent RW, child RO: file under child is still NOT blocked (parent RW wins because longer match absent)", () => {
    // This tests the current behavior: RW match on parent is found first.
    // The child RO is more specific but classifyAuthLevel uses RW-first check.
    const roDirs = ["c:\\data\\sub\\"];
    const rwDirs = ["c:\\data\\"];
    // isBlockedPath: rwMatchLen = "c:\\data\\".length (parent), roMatchLen = "c:\\data\\sub\\".length (child)
    // rwMatchLen > 0 but rwMatchLen < roMatchLen → blocked!
    expect(isBlockedPath("C:\\Data\\Sub\\file.txt", rwDirs, roDirs)).toBe(true);
  });

  it("no matching dirs: file is blocked", () => {
    expect(isBlockedPath("C:\\Other\\file.txt", [], [])).toBe(true);
  });
});

// ── Parent/child directory hierarchy policy tests ──
// Tests the rules enforced by sandbox:add-user-dir in main.ts

describe("parent/child directory hierarchy policy", () => {
  // Simulates the decision logic from sandbox:add-user-dir
  type AddResult = { action: "add" } | { action: "skip"; reason: string };

  function checkAddDir(
    dir: string,
    access: "rw" | "ro",
    currentRW: string[],
    currentRO: string[],
  ): AddResult {
    const current = access === "rw" ? currentRW : currentRO;

    // Already in same list
    if (current.some(d => d.toLowerCase() === dir.toLowerCase())) {
      return { action: "skip", reason: "duplicate" };
    }

    // Parent with same access already covers this child
    for (const existing of current) {
      if (isSubdirectoryOf(existing, dir)) {
        return { action: "skip", reason: "parent-covers" };
      }
    }

    // Parent has RW → child RO is ineffective
    if (access === "ro") {
      for (const rwDir of currentRW) {
        if (isSubdirectoryOf(rwDir, dir)) {
          return { action: "skip", reason: "parent-rw-covers" };
        }
      }
    }

    return { action: "add" };
  }

  describe("parent covers child (same access)", () => {
    it("parent RW exists, adding child RW → skip", () => {
      const result = checkAddDir("C:\\Data\\Sub", "rw", ["C:\\Data"], []);
      expect(result).toEqual({ action: "skip", reason: "parent-covers" });
    });

    it("parent RO exists, adding child RO → skip", () => {
      const result = checkAddDir("C:\\Data\\Sub", "ro", [], ["C:\\Data"]);
      expect(result).toEqual({ action: "skip", reason: "parent-covers" });
    });

    it("deep nesting: grandparent covers grandchild", () => {
      const result = checkAddDir("C:\\Data\\A\\B\\C", "rw", ["C:\\Data"], []);
      expect(result).toEqual({ action: "skip", reason: "parent-covers" });
    });
  });

  describe("parent RW makes child RO ineffective", () => {
    it("parent RW exists, adding child RO → skip (inherited ACL)", () => {
      const result = checkAddDir("C:\\Data\\Sub", "ro", ["C:\\Data"], []);
      expect(result).toEqual({ action: "skip", reason: "parent-rw-covers" });
    });

    it("deep nesting: grandparent RW blocks grandchild RO", () => {
      const result = checkAddDir("C:\\Data\\A\\B", "ro", ["C:\\Data"], []);
      expect(result).toEqual({ action: "skip", reason: "parent-rw-covers" });
    });
  });

  describe("valid combinations", () => {
    it("parent RO, adding child RW → allowed (escalation)", () => {
      const result = checkAddDir("C:\\Data\\Sub", "rw", [], ["C:\\Data"]);
      expect(result).toEqual({ action: "add" });
    });

    it("no parent exists → allowed", () => {
      const result = checkAddDir("C:\\NewDir", "rw", ["C:\\Other"], []);
      expect(result).toEqual({ action: "add" });
    });

    it("child exists, adding parent → allowed (parent is not a sub of child)", () => {
      const result = checkAddDir("C:\\Data", "rw", ["C:\\Data\\Sub"], []);
      expect(result).toEqual({ action: "add" });
    });

    it("sibling directory → allowed", () => {
      const result = checkAddDir("C:\\Data2", "rw", ["C:\\Data"], []);
      expect(result).toEqual({ action: "add" });
    });
  });

  // Tests for auto-removal of redundant children when adding a parent
  describe("auto-remove redundant children", () => {
    function getChildrenToRemove(
      parentDir: string,
      parentAccess: "rw" | "ro",
      rwDirs: string[],
      roDirs: string[],
    ): { removedRW: string[]; removedRO: string[]; keptRW: string[] } {
      if (parentAccess === "rw") {
        // Parent RW → remove all children
        const removedRW = rwDirs.filter(d => d !== parentDir && isSubdirectoryOf(parentDir, d));
        const removedRO = roDirs.filter(d => isSubdirectoryOf(parentDir, d));
        return { removedRW, removedRO, keptRW: [] };
      } else {
        // Parent RO → remove child RO, keep child RW
        const removedRO = roDirs.filter(d => d !== parentDir && isSubdirectoryOf(parentDir, d));
        const keptRW = rwDirs.filter(d => isSubdirectoryOf(parentDir, d));
        return { removedRW: [], removedRO, keptRW };
      }
    }

    it("adding parent RW removes child RW", () => {
      const result = getChildrenToRemove("C:\\Data", "rw", ["C:\\Data\\Sub"], []);
      expect(result.removedRW).toEqual(["C:\\Data\\Sub"]);
    });

    it("adding parent RW removes child RO", () => {
      const result = getChildrenToRemove("C:\\Data", "rw", [], ["C:\\Data\\Sub"]);
      expect(result.removedRO).toEqual(["C:\\Data\\Sub"]);
    });

    it("adding parent RW removes both child RW and RO", () => {
      const result = getChildrenToRemove("C:\\Data", "rw", ["C:\\Data\\A"], ["C:\\Data\\B"]);
      expect(result.removedRW).toEqual(["C:\\Data\\A"]);
      expect(result.removedRO).toEqual(["C:\\Data\\B"]);
    });

    it("adding parent RO removes child RO but keeps child RW", () => {
      const result = getChildrenToRemove("C:\\Data", "ro", ["C:\\Data\\RWChild"], ["C:\\Data\\ROChild"]);
      expect(result.removedRW).toEqual([]);
      expect(result.removedRO).toEqual(["C:\\Data\\ROChild"]);
      expect(result.keptRW).toEqual(["C:\\Data\\RWChild"]);
    });

    it("non-subdirectory dirs are not removed", () => {
      const result = getChildrenToRemove("C:\\Data", "rw", ["C:\\Other", "C:\\Data\\Sub"], ["D:\\Docs"]);
      expect(result.removedRW).toEqual(["C:\\Data\\Sub"]);
      expect(result.removedRO).toEqual([]);
    });
  });
});

// ── isSafeDiagnosticCommand / isSafeDiagnosticCommandStr ──
// Tests for the safe diagnostic tool bypass that allows low-risk system
// tools (ping, tracert, nslookup, hostname, arp) to run outside AppContainer.

const { isSafeDiagnosticCommand, isSafeDiagnosticCommandStr } = cpHooks;

describe("isSafeDiagnosticCommand", () => {
  describe("allowed commands", () => {
    it("ping with host", () => {
      expect(isSafeDiagnosticCommand("cmd.exe", ["/c", "ping 8.8.8.8"])).toBe(true);
    });

    it("ping with flags", () => {
      expect(isSafeDiagnosticCommand("cmd.exe", ["/c", "ping -n 4 google.com"])).toBe(true);
    });

    it("tracert", () => {
      expect(isSafeDiagnosticCommand("cmd.exe", ["/c", "tracert google.com"])).toBe(true);
    });

    it("nslookup", () => {
      expect(isSafeDiagnosticCommand("cmd.exe", ["/c", "nslookup example.com"])).toBe(true);
    });

    it("hostname", () => {
      expect(isSafeDiagnosticCommand("cmd.exe", ["/c", "hostname"])).toBe(true);
    });

    it("arp -a", () => {
      expect(isSafeDiagnosticCommand("cmd.exe", ["/c", "arp -a"])).toBe(true);
    });

    it("arp piped to findstr", () => {
      expect(isSafeDiagnosticCommand("cmd.exe", ["/c", 'arp -a | findstr /C:"---"'])).toBe(true);
    });

    it("ping piped to find", () => {
      expect(isSafeDiagnosticCommand("cmd.exe", ["/c", 'ping 8.8.8.8 | find "Reply"'])).toBe(true);
    });

    it("pathping", () => {
      expect(isSafeDiagnosticCommand("cmd.exe", ["/c", "pathping google.com"])).toBe(true);
    });

    it("multiple safe commands chained with &&", () => {
      expect(isSafeDiagnosticCommand("cmd.exe", ["/c", "hostname && ping 8.8.8.8"])).toBe(true);
    });

    it("via powershell -Command", () => {
      expect(isSafeDiagnosticCommand("powershell.exe", ["-Command", "ping 8.8.8.8"])).toBe(true);
    });

    it("piped through more", () => {
      expect(isSafeDiagnosticCommand("cmd.exe", ["/c", "arp -a | more"])).toBe(true);
    });

    it("piped through sort", () => {
      expect(isSafeDiagnosticCommand("cmd.exe", ["/c", "arp -a | sort"])).toBe(true);
    });
  });

  describe("blocked commands", () => {
    it("rejects dir (not a diagnostic tool)", () => {
      expect(isSafeDiagnosticCommand("cmd.exe", ["/c", "dir C:\\"])).toBe(false);
    });

    it("rejects netstat (info-sensitive)", () => {
      expect(isSafeDiagnosticCommand("cmd.exe", ["/c", "netstat -an"])).toBe(false);
    });

    it("rejects systeminfo (info-sensitive)", () => {
      expect(isSafeDiagnosticCommand("cmd.exe", ["/c", "systeminfo"])).toBe(false);
    });

    it("rejects whoami (info-sensitive)", () => {
      expect(isSafeDiagnosticCommand("cmd.exe", ["/c", "whoami"])).toBe(false);
    });

    it("rejects ipconfig (info-sensitive)", () => {
      expect(isSafeDiagnosticCommand("cmd.exe", ["/c", "ipconfig /all"])).toBe(false);
    });

    it("rejects ping chained with del (unsafe combo)", () => {
      expect(isSafeDiagnosticCommand("cmd.exe", ["/c", "ping 8.8.8.8 && del C:\\important"])).toBe(false);
    });

    it("rejects safe tool piped to powershell (unsafe filter)", () => {
      expect(isSafeDiagnosticCommand("cmd.exe", ["/c", "arp -a | powershell -c Write-Host"])).toBe(false);
    });

    it("rejects empty payload", () => {
      expect(isSafeDiagnosticCommand("cmd.exe", ["/c", ""])).toBe(false);
    });

    it("rejects no args", () => {
      expect(isSafeDiagnosticCommand("cmd.exe", [])).toBe(false);
    });
  });

  describe("injection attacks", () => {
    it("rejects single & separator: ping & del", () => {
      expect(isSafeDiagnosticCommand("cmd.exe", ["/c", "ping 8.8.8.8 & del C:\\file"])).toBe(false);
    });

    it("rejects single & with safe first but unsafe second", () => {
      expect(isSafeDiagnosticCommand("cmd.exe", ["/c", "hostname & whoami"])).toBe(false);
    });

    it("rejects output redirection: ping > file", () => {
      expect(isSafeDiagnosticCommand("cmd.exe", ["/c", "ping 8.8.8.8 > C:\\out.txt"])).toBe(false);
    });

    it("rejects append redirection: ping >> file", () => {
      expect(isSafeDiagnosticCommand("cmd.exe", ["/c", "ping 8.8.8.8 >> C:\\out.txt"])).toBe(false);
    });

    it("rejects input redirection: ping < file", () => {
      expect(isSafeDiagnosticCommand("cmd.exe", ["/c", "ping < C:\\hosts.txt"])).toBe(false);
    });

    it("rejects PowerShell subexpression: $()", () => {
      expect(isSafeDiagnosticCommand("powershell.exe", ["-Command", "ping $(Invoke-Expression 'malicious')"])).toBe(false);
    });

    it("rejects backtick escape sequences", () => {
      expect(isSafeDiagnosticCommand("powershell.exe", ["-Command", "ping `& malicious"])).toBe(false);
    });

    it("rejects pipe to cmd.exe", () => {
      expect(isSafeDiagnosticCommand("cmd.exe", ["/c", "ping 8.8.8.8 | cmd /c del C:\\file"])).toBe(false);
    });

    it("rejects double-& with unsafe trailing command", () => {
      expect(isSafeDiagnosticCommand("cmd.exe", ["/c", "ping 8.8.8.8 && powershell -c Remove-Item"])).toBe(false);
    });

    it("rejects || with unsafe fallback", () => {
      expect(isSafeDiagnosticCommand("cmd.exe", ["/c", "ping 8.8.8.8 || del C:\\file"])).toBe(false);
    });

    it("allows single & between two safe tools", () => {
      expect(isSafeDiagnosticCommand("cmd.exe", ["/c", "ping 8.8.8.8 & hostname"])).toBe(true);
    });
  });
});

describe("isSafeDiagnosticCommandStr", () => {
  it("allows arp -a | findstr", () => {
    expect(isSafeDiagnosticCommandStr('arp -a | findstr /C:"---"')).toBe(true);
  });

  it("allows ping", () => {
    expect(isSafeDiagnosticCommandStr("ping 8.8.8.8")).toBe(true);
  });

  it("blocks del command", () => {
    expect(isSafeDiagnosticCommandStr("del C:\\file.txt")).toBe(false);
  });

  it("blocks mixed safe + unsafe", () => {
    expect(isSafeDiagnosticCommandStr("ping 8.8.8.8 && whoami")).toBe(false);
  });

  it("blocks empty string", () => {
    expect(isSafeDiagnosticCommandStr("")).toBe(false);
  });

  it("blocks single & injection: ping & del", () => {
    expect(isSafeDiagnosticCommandStr("ping 8.8.8.8 & del C:\\file")).toBe(false);
  });

  it("blocks output redirection", () => {
    expect(isSafeDiagnosticCommandStr("ping 8.8.8.8 > C:\\out.txt")).toBe(false);
  });

  it("blocks PowerShell subexpression", () => {
    expect(isSafeDiagnosticCommandStr("ping $(IEX 'evil')")).toBe(false);
  });

  it("blocks backtick escape", () => {
    expect(isSafeDiagnosticCommandStr("ping `& malicious")).toBe(false);
  });

  it("allows single & between safe tools", () => {
    expect(isSafeDiagnosticCommandStr("ping 8.8.8.8 & hostname")).toBe(true);
  });
});

// ── extractLaunchedApp ──
// Detects the name of an external application being launched by a shell command.
// Must NOT false-positive on .exe paths that are file arguments to file
// manipulation cmdlets like Move-Item, Copy-Item, etc.

const { extractLaunchedApp } = cpHooks;

describe("extractLaunchedApp", () => {
  // Helper: simulate pwsh.exe being the cmd, with given args
  const pwsh = "C:\\Program Files\\PowerShell\\7\\pwsh.exe";

  describe("correctly detects real app launches", () => {
    it("Start-Process with exe name", () => {
      expect(extractLaunchedApp(pwsh, ["-Command", "Start-Process notepad"])).toBe("notepad");
    });

    it("Start-Process with full path", () => {
      expect(extractLaunchedApp(pwsh, ["-Command", "Start-Process C:\\Windows\\notepad.exe"])).toBe("notepad");
    });

    it("& invocation operator with quoted path", () => {
      expect(extractLaunchedApp(pwsh, ["-Command", "& 'C:\\Tools\\myapp.exe' --flag"])).toBe("myapp");
    });

    it("direct exe path invocation", () => {
      expect(extractLaunchedApp(pwsh, ["-Command", "C:\\Tools\\myapp.exe --arg"])).toBe("myapp");
    });

    it("Invoke-Item with exe", () => {
      expect(extractLaunchedApp(pwsh, ["-Command", "Invoke-Item C:\\Tools\\psping64.exe"])).toBe("psping64");
    });

    it("cmd start command", () => {
      expect(extractLaunchedApp("cmd.exe", ["/c", "start notepad"])).toBe("notepad");
    });
  });

  describe("does NOT false-positive on file manipulation cmdlets", () => {
    // Exact command from the bug screenshot:
    // C:\Program Files\PowerShell\7\pwsh.exe -NoProfile -NonInteractive
    //   -Command powershell -NoProfile -NonInteractive -Command
    //   "Move-Item -LiteralPath 'C:\Users\yuxwei\Desktop\psping64.exe'
    //    -Destination 'C:\..."
    it("screenshot bug: Move-Item -LiteralPath psping64.exe mis-detected as app launch", () => {
      expect(extractLaunchedApp(pwsh, [
        "-NoProfile", "-NonInteractive", "-Command",
        "powershell", "-NoProfile", "-NonInteractive", "-Command",
        "Move-Item -LiteralPath 'C:\\Users\\yuxwei\\Desktop\\psping64.exe' -Destination 'C:\\Tools\\psping64.exe'",
      ])).toBeNull();
    });

    it("Move-Item with unquoted .exe path", () => {
      expect(extractLaunchedApp(pwsh, [
        "-Command",
        "Move-Item C:\\Users\\test\\app.exe C:\\Dest\\app.exe",
      ])).toBeNull();
    });

    it("Copy-Item with .exe source", () => {
      expect(extractLaunchedApp(pwsh, [
        "-Command",
        "Copy-Item -Path 'C:\\Source\\tool.exe' -Destination 'C:\\Dest\\tool.exe'",
      ])).toBeNull();
    });

    it("Remove-Item with .exe", () => {
      expect(extractLaunchedApp(pwsh, [
        "-Command",
        "Remove-Item 'C:\\Temp\\old-tool.exe'",
      ])).toBeNull();
    });

    it("Rename-Item with .exe", () => {
      expect(extractLaunchedApp(pwsh, [
        "-Command",
        "Rename-Item 'C:\\Tools\\app-old.exe' 'app-new.exe'",
      ])).toBeNull();
    });

    it("Get-Item with .exe", () => {
      expect(extractLaunchedApp(pwsh, [
        "-Command",
        "Get-Item 'C:\\Tools\\psping64.exe'",
      ])).toBeNull();
    });

    it("Get-FileHash with .exe", () => {
      expect(extractLaunchedApp(pwsh, [
        "-Command",
        "Get-FileHash 'C:\\Tools\\installer.exe'",
      ])).toBeNull();
    });

    it("nested shell: pwsh -Command Move-Item .exe", () => {
      expect(extractLaunchedApp(pwsh, [
        "-NoProfile", "-NonInteractive", "-Command",
        "powershell -NoProfile -NonInteractive -Command \"Move-Item -LiteralPath 'C:\\Users\\admin\\Desktop\\psping64.exe' -Destination 'C:\\Tools'\"",
      ])).toBeNull();
    });

    it("cmd del with .exe", () => {
      expect(extractLaunchedApp("cmd.exe", [
        "/c", "del C:\\Temp\\old-app.exe",
      ])).toBeNull();
    });

    it("cmd copy with .exe", () => {
      expect(extractLaunchedApp("cmd.exe", [
        "/c", "copy C:\\Source\\app.exe C:\\Dest\\app.exe",
      ])).toBeNull();
    });
  });

  describe("returns null for non-app commands", () => {
    it("simple dir command", () => {
      expect(extractLaunchedApp(pwsh, ["-Command", "dir C:\\Users"])).toBeNull();
    });

    it("echo command", () => {
      expect(extractLaunchedApp(pwsh, ["-Command", "echo hello"])).toBeNull();
    });

    it("empty args", () => {
      expect(extractLaunchedApp(pwsh, [])).toBeNull();
    });
  });
});

// ── Inline declare-access parsing ──
// Tests the regex patterns and payload boundary detection used by
// tryInlineDeclareAccess. These are pure regex tests — no sandbox activation
// or permission IPC needed.

describe("inline declare-access parsing", () => {
  const { DECLARE_TAG_RE } = cpHooks;

  describe("DECLARE_TAG_RE", () => {
    it("matches basic tag with single rw entry", () => {
      const m = DECLARE_TAG_RE.exec("[declare-access]rw:C:\\a[/declare-access]");
      expect(m).not.toBeNull();
      expect(m![1]).toBe("rw:C:\\a");
    });

    it("matches tag with ro entry", () => {
      const m = DECLARE_TAG_RE.exec("[declare-access]ro:C:\\data[/declare-access]");
      expect(m).not.toBeNull();
      expect(m![1]).toBe("ro:C:\\data");
    });

    it("matches tag with multiple semicolon-separated entries", () => {
      const m = DECLARE_TAG_RE.exec("[declare-access]rw:C:\\a;ro:C:\\b[/declare-access]");
      expect(m).not.toBeNull();
      expect(m![1]).toBe("rw:C:\\a;ro:C:\\b");
    });

    it("matches tag with path containing spaces", () => {
      const m = DECLARE_TAG_RE.exec("[declare-access]rw:C:\\Users\\hasu\\OneDrive - Microsoft\\Desktop[/declare-access]");
      expect(m).not.toBeNull();
      expect(m![1]).toBe("rw:C:\\Users\\hasu\\OneDrive - Microsoft\\Desktop");
    });

    it("matches tag with $env variable", () => {
      const m = DECLARE_TAG_RE.exec("[declare-access]rw:$env:USERPROFILE\\Downloads[/declare-access]");
      expect(m).not.toBeNull();
      expect(m![1]).toBe("rw:$env:USERPROFILE\\Downloads");
    });

    it("matches tag embedded in comment line", () => {
      const cmd = "# [declare-access]rw:C:\\a;rw:C:\\b[/declare-access]\nMove-Item C:\\a\\f.txt C:\\b\\";
      const m = DECLARE_TAG_RE.exec(cmd);
      expect(m).not.toBeNull();
      expect(m![1]).toBe("rw:C:\\a;rw:C:\\b");
    });

    it("matches case-insensitively", () => {
      const m = DECLARE_TAG_RE.exec("[Declare-Access]rw:C:\\a[/Declare-Access]");
      expect(m).not.toBeNull();
      expect(m![1]).toBe("rw:C:\\a");
    });

    it("does not match unrelated commands", () => {
      expect(DECLARE_TAG_RE.exec("Get-ChildItem C:\\a")).toBeNull();
    });

    it("does not match incomplete tags", () => {
      expect(DECLARE_TAG_RE.exec("[declare-access]rw:C:\\a")).toBeNull();
    });
  });

  describe("tag stripping", () => {
    // Simulate the stripping logic from tryInlineDeclareAccess
    function stripTag(cmdStr: string): string | null {
      const m = DECLARE_TAG_RE.exec(cmdStr);
      if (!m) return null;
      const before = cmdStr.substring(0, m.index);
      const after = cmdStr.substring(m.index + m[0].length);
      const cleaned = before.replace(/(?:#|\/\/|::|REM)\s*$/i, "") + after;
      return cleaned.replace(/^[ \t]*[\r\n]+/m, "").trim() || null;
    }

    it("strips tag from multi-line comment + command", () => {
      const cmd = "# [declare-access]rw:C:\\a[/declare-access]\nMove-Item C:\\a\\f.txt C:\\b\\";
      expect(stripTag(cmd)).toBe("Move-Item C:\\a\\f.txt C:\\b\\");
    });

    it("strips tag from single-line (tag + command, no newline)", () => {
      const cmd = "# [declare-access]rw:C:\\a[/declare-access] Move-Item C:\\a\\f.txt C:\\b\\";
      const rest = stripTag(cmd);
      expect(rest).toBe("Move-Item C:\\a\\f.txt C:\\b\\");
    });

    it("strips tag from single-line with Get-ChildItem", () => {
      const cmd = "# [declare-access]ro:C:\\a[/declare-access] Get-ChildItem -Force C:\\a | Select-Object Mode,Length,LastWriteTime,Name | Format-Table -AutoSize";
      const rest = stripTag(cmd);
      expect(rest).toBe("Get-ChildItem -Force C:\\a | Select-Object Mode,Length,LastWriteTime,Name | Format-Table -AutoSize");
    });

    it("strips tag with path containing spaces", () => {
      const cmd = "# [declare-access]rw:C:\\Users\\hasu\\OneDrive - Microsoft\\Desktop[/declare-access]\n$desktop = 'C:\\Users\\hasu\\OneDrive - Microsoft\\Desktop'\nGet-ChildItem -Force $desktop";
      const rest = stripTag(cmd);
      expect(rest).toContain("$desktop");
      expect(rest).not.toContain("[declare-access]");
    });

    it("strips tag with // comment prefix", () => {
      const cmd = "// [declare-access]ro:C:\\data[/declare-access]\nGet-Content C:\\data\\f.txt";
      expect(stripTag(cmd)).toBe("Get-Content C:\\data\\f.txt");
    });

    it("strips tag with :: comment prefix", () => {
      const cmd = ":: [declare-access]rw:C:\\temp[/declare-access]\ndir C:\\temp";
      expect(stripTag(cmd)).toBe("dir C:\\temp");
    });

    it("returns null for non-declare command", () => {
      expect(stripTag("Get-ChildItem C:\\a")).toBeNull();
    });

    it("the real-world failing case: OneDrive path single-line", () => {
      const cmd = "# [declare-access]rw:C:\\Users\\hasu\\OneDrive - Microsoft\\Desktop[/declare-access] $desktop = 'C:\\Users\\hasu\\OneDrive - Microsoft\\Desktop' Get-ChildItem -LiteralPath $desktop -Force";
      const rest = stripTag(cmd);
      expect(rest).not.toBeNull();
      expect(rest).toContain("$desktop");
      expect(rest).not.toContain("[declare-access]");
      expect(rest).not.toContain("[/declare-access]");
    });

    it("the real-world complex command: multi-path single-line", () => {
      const cmd = "# [declare-access]ro:C:\\Users\\hasu\\.openclaw;ro:C:\\Users\\hasu\\.openclaw-node;ro:C:\\Users\\hasu\\Desktop[/declare-access] $ErrorActionPreference='Stop' $skillHits = @() $roots = @('C:\\Users\\hasu\\.openclaw','C:\\Users\\hasu\\.openclaw-node') | Where-Object { Test-Path $_ } foreach ($root in $roots) { $skillHits += Get-ChildItem -Path $root -Recurse -File -Filter 'SKILL.md' -ErrorAction SilentlyContinue } $desktopItems = Get-ChildItem -Force 'C:\\Users\\hasu\\Desktop' | Select-Object Name,FullName";
      const rest = stripTag(cmd);
      expect(rest).not.toBeNull();
      expect(rest).toContain("$ErrorActionPreference");
      expect(rest).toContain("Get-ChildItem");
      expect(rest).not.toContain("[declare-access]");
      expect(rest).not.toContain("[/declare-access]");
    });

    it("extracts declare-access payload from multi-path tag", () => {
      const cmd = "# [declare-access]ro:C:\\Users\\hasu\\.openclaw;ro:C:\\Users\\hasu\\.openclaw-node;ro:C:\\Users\\hasu\\Desktop[/declare-access] Get-ChildItem C:\\Users\\hasu\\Desktop";
      const m = DECLARE_TAG_RE.exec(cmd);
      expect(m).not.toBeNull();
      expect(m![1]).toBe("ro:C:\\Users\\hasu\\.openclaw;ro:C:\\Users\\hasu\\.openclaw-node;ro:C:\\Users\\hasu\\Desktop");
      const entries = m![1].split(";");
      expect(entries).toHaveLength(3);
      expect(entries[0]).toBe("ro:C:\\Users\\hasu\\.openclaw");
      expect(entries[1]).toBe("ro:C:\\Users\\hasu\\.openclaw-node");
      expect(entries[2]).toBe("ro:C:\\Users\\hasu\\Desktop");
    });
  });
});
