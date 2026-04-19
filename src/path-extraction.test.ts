/**
 * Tests for sandbox path extraction regex patterns.
 *
 * These test the shared path-extraction module used by sandbox-preload.js
 * to determine which file paths a shell command will read/write.
 */
import { describe, it, expect } from "vitest";
import path from "path";

// Import the shared JS module (CommonJS)
const pe = require("../../appcontainer/path-extraction.js");
const {
  extractWritePaths,
  extractReadPaths,
  extractShellPayload,
  cleanExtractedPath,
  expandEnvVarsInCmd,
} = pe;

// ── extractShellPayload ──

describe("extractShellPayload", () => {
  it("strips pwsh.exe full path and flags", () => {
    expect(extractShellPayload(
      "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
      ["-NoProfile", "-Command", "dir C:\\a C:\\b"],
    )).toBe("dir C:\\a C:\\b");
  });

  it("strips cmd.exe and /d /s /c flags", () => {
    expect(extractShellPayload(
      "C:\\Windows\\System32\\cmd.exe",
      ["/d", "/s", "/c", "dir C:\\a"],
    )).toBe("dir C:\\a");
  });

  it("strips powershell short name", () => {
    expect(extractShellPayload(
      "powershell",
      ["-Command", "Get-ChildItem C:\\a"],
    )).toBe("Get-ChildItem C:\\a");
  });

  it("handles pwsh without -Command (positional args)", () => {
    expect(extractShellPayload(
      "pwsh",
      ["-NoProfile", "Get-ChildItem C:\\a"],
    )).toBe("Get-ChildItem C:\\a");
  });

  it("strips wrapping quotes from payload", () => {
    expect(extractShellPayload(
      "cmd.exe",
      ["/c", '"dir C:\\a"'],
    )).toBe("dir C:\\a");
  });
});

// ── extractReadPaths ──

describe("extractReadPaths", () => {
  describe("comma-separated paths", () => {
    it("splits on comma+space (PowerShell array syntax)", () => {
      const paths = extractReadPaths("dir C:\\a, C:\\b, C:\\c, C:\\d");
      expect(paths).toEqual(["C:\\a", "C:\\b", "C:\\c", "C:\\d"]);
    });

    it("splits on bare comma", () => {
      const paths = extractReadPaths("dir C:\\a,C:\\b");
      expect(paths).toEqual(["C:\\a", "C:\\b"]);
    });

    it("preserves commas inside quotes", () => {
      const paths = extractReadPaths('dir "C:\\my, folder"');
      expect(paths).toContain("C:\\my, folder");
    });

    it("preserves bare commas inside quotes", () => {
      const paths = extractReadPaths('dir "C:\\my,folder"');
      expect(paths).toContain("C:\\my,folder");
    });

    it("does not leave trailing commas on paths", () => {
      const paths = extractReadPaths("dir C:\\a, C:\\b");
      for (const p of paths) {
        expect(p).not.toMatch(/,$/);
      }
    });
  });

  describe("dir / Get-ChildItem and aliases", () => {
    it("extracts single unquoted dir path", () => {
      const paths = extractReadPaths("dir C:\\Users\\test");
      expect(paths).toContain("C:\\Users\\test");
    });

    it("extracts quoted dir path with spaces", () => {
      const paths = extractReadPaths('dir "C:\\Users\\My Documents"');
      expect(paths).toContain("C:\\Users\\My Documents");
    });

    it("extracts Get-ChildItem with -Path", () => {
      const paths = extractReadPaths("Get-ChildItem -Path C:\\data");
      expect(paths).toContain("C:\\data");
    });

    it("extracts Get-ChildItem unquoted", () => {
      const paths = extractReadPaths("Get-ChildItem C:\\a -ErrorAction SilentlyContinue");
      expect(paths).toContain("C:\\a");
    });

    it("extracts Get-ChildItem quoted with spaces", () => {
      const paths = extractReadPaths('Get-ChildItem "C:\\Program Files\\app"');
      expect(paths).toContain("C:\\Program Files\\app");
    });

    it("extracts ls alias unquoted", () => {
      expect(extractReadPaths("ls C:\\data")).toContain("C:\\data");
    });

    it("extracts ls alias quoted", () => {
      expect(extractReadPaths('ls "C:\\my folder"')).toContain("C:\\my folder");
    });

    it("extracts gci alias unquoted", () => {
      expect(extractReadPaths("gci C:\\temp")).toContain("C:\\temp");
    });

    it("extracts gci alias with -Path", () => {
      expect(extractReadPaths("gci -Path C:\\logs")).toContain("C:\\logs");
    });

    it("extracts Get-ChildItem with -Force before unquoted path", () => {
      const paths = extractReadPaths("Get-ChildItem -Force C:\\a | Select-Object Mode,Length,LastWriteTime,Name | Format-Table -AutoSize");
      expect(paths).toContain("C:\\a");
    });

    it("extracts Get-ChildItem with -Force before quoted path", () => {
      const paths = extractReadPaths('Get-ChildItem -Force "C:\\Users\\My Folder"');
      expect(paths).toContain("C:\\Users\\My Folder");
    });

    it("extracts Get-ChildItem with multiple switches before path", () => {
      const paths = extractReadPaths("Get-ChildItem -Force -Recurse C:\\data");
      expect(paths).toContain("C:\\data");
    });

    it("extracts gci with -Hidden before path", () => {
      expect(extractReadPaths("gci -Hidden C:\\temp")).toContain("C:\\temp");
    });

    it("extracts ls with -Force -Path", () => {
      expect(extractReadPaths("ls -Force -Path C:\\logs")).toContain("C:\\logs");
    });
  });

  describe("Get-Content / cat / type and aliases", () => {
    it("extracts Get-Content unquoted", () => {
      expect(extractReadPaths("Get-Content C:\\a\\test.txt")).toContain("C:\\a\\test.txt");
    });

    it("extracts Get-Content quoted", () => {
      expect(extractReadPaths('Get-Content "C:\\a\\my file.txt"')).toContain("C:\\a\\my file.txt");
    });

    it("extracts gc alias unquoted", () => {
      expect(extractReadPaths("gc C:\\data\\file.txt")).toContain("C:\\data\\file.txt");
    });

    it("extracts gc alias quoted", () => {
      expect(extractReadPaths('gc "C:\\my docs\\file.txt"')).toContain("C:\\my docs\\file.txt");
    });

    it("extracts cat unquoted", () => {
      expect(extractReadPaths("cat C:\\logs\\app.log")).toContain("C:\\logs\\app.log");
    });

    it("extracts type unquoted", () => {
      expect(extractReadPaths("type C:\\readme.txt")).toContain("C:\\readme.txt");
    });

    it("extracts head unquoted", () => {
      expect(extractReadPaths("head C:\\logs\\app.log")).toContain("C:\\logs\\app.log");
    });

    it("extracts tail unquoted", () => {
      expect(extractReadPaths("tail C:\\logs\\app.log")).toContain("C:\\logs\\app.log");
    });
  });

  describe("Test-Path / Resolve-Path", () => {
    it("extracts Test-Path unquoted", () => {
      expect(extractReadPaths("Test-Path C:\\config\\app.json")).toContain("C:\\config\\app.json");
    });

    it("extracts Resolve-Path quoted", () => {
      expect(extractReadPaths('Resolve-Path "C:\\data\\*.csv"')).toContain("C:\\data");
    });
  });

  describe("Select-String and alias", () => {
    it("extracts Select-String with -Path", () => {
      expect(extractReadPaths('Select-String -Path "C:\\logs\\app.log" -Pattern "error"'))
        .toContain("C:\\logs\\app.log");
    });

    it("extracts sls alias unquoted", () => {
      expect(extractReadPaths("sls C:\\data\\file.csv")).toContain("C:\\data\\file.csv");
    });
  });

  describe("Import-Csv / Get-FileHash", () => {
    it("extracts Import-Csv quoted", () => {
      expect(extractReadPaths('Import-Csv "C:\\data\\records.csv"')).toContain("C:\\data\\records.csv");
    });

    it("extracts Import-Csv unquoted", () => {
      expect(extractReadPaths("Import-Csv C:\\data\\records.csv")).toContain("C:\\data\\records.csv");
    });

    it("extracts Get-FileHash quoted", () => {
      expect(extractReadPaths('Get-FileHash "C:\\downloads\\setup.exe"')).toContain("C:\\downloads\\setup.exe");
    });

    it("extracts Get-FileHash unquoted", () => {
      expect(extractReadPaths("Get-FileHash C:\\app\\binary.dll")).toContain("C:\\app\\binary.dll");
    });
  });

  describe("Get-Item and alias", () => {
    it("extracts Get-Item unquoted", () => {
      expect(extractReadPaths("Get-Item C:\\config")).toContain("C:\\config");
    });

    it("extracts gi alias unquoted", () => {
      expect(extractReadPaths("gi C:\\data")).toContain("C:\\data");
    });
  });

  describe("icacls (read-only)", () => {
    it("extracts icacls target path", () => {
      expect(extractReadPaths("icacls C:\\secure\\folder")).toContain("C:\\secure\\folder");
    });

    it("extracts icacls quoted path", () => {
      expect(extractReadPaths('icacls "C:\\my folder"')).toContain("C:\\my folder");
    });
  });

  describe("find / findstr", () => {
    it("extracts findstr target file", () => {
      const paths = extractReadPaths('findstr "pattern" C:\\logs\\app.log');
      expect(paths).toContain("C:\\logs\\app.log");
    });
  });

  describe("Python read", () => {
    it("extracts open() default read mode", () => {
      const paths = extractReadPaths('open("C:\\data\\input.csv")');
      expect(paths).toContain("C:\\data\\input.csv");
    });

    it("extracts open() explicit 'r' mode", () => {
      const paths = extractReadPaths('open("C:\\data\\input.csv", "r")');
      expect(paths).toContain("C:\\data\\input.csv");
    });
  });

  describe(".NET read methods", () => {
    it("extracts File::ReadAllText", () => {
      const paths = extractReadPaths('[System.IO.File]::ReadAllText("C:\\data\\config.json")');
      expect(paths).toContain("C:\\data\\config.json");
    });
  });

  describe("generic fallback", () => {
    it("catches unquoted paths not matched by specific patterns", () => {
      const paths = extractReadPaths("somecmd C:\\unknown\\path");
      expect(paths).toContain("C:\\unknown\\path");
    });

    it("does not match shell executable paths (after extractShellPayload)", () => {
      // After extractShellPayload, the shell exe is stripped.
      // This tests that the payload alone doesn't leak "C:\Program"
      const payload = "dir C:\\a C:\\b C:\\c";
      const paths = extractReadPaths(payload);
      expect(paths).not.toContain("C:\\Program");
      expect(paths).toContain("C:\\a");
      expect(paths).toContain("C:\\b");
      expect(paths).toContain("C:\\c");
    });
  });

  describe("glob patterns", () => {
    it("resolves globs to parent directory", () => {
      const paths = extractReadPaths("dir C:\\Users\\test\\*.pdf");
      expect(paths).toContain("C:\\Users\\test");
      expect(paths).not.toContain("C:\\Users\\test\\*.pdf");
    });
  });
});

// ── extractWritePaths ──

describe("extractWritePaths", () => {
  describe("PowerShell write cmdlets", () => {
    it("extracts Out-File quoted path", () => {
      expect(extractWritePaths('Out-File "C:\\output\\result.txt"')).toContain("C:\\output\\result.txt");
    });

    it("extracts Out-File unquoted path", () => {
      expect(extractWritePaths("Out-File C:\\output\\result.txt")).toContain("C:\\output\\result.txt");
    });

    it("extracts Set-Content with -Path", () => {
      expect(extractWritePaths('Set-Content -Path "C:\\a\\test.txt" -Value "hello"')).toContain("C:\\a\\test.txt");
    });

    it("extracts Add-Content unquoted", () => {
      expect(extractWritePaths("Add-Content C:\\logs\\app.log")).toContain("C:\\logs\\app.log");
    });

    it("extracts New-Item quoted", () => {
      expect(extractWritePaths('New-Item "C:\\output\\new folder"')).toContain("C:\\output\\new folder");
    });

    it("extracts New-Item with -ItemType and -Path before quoted path", () => {
      expect(extractWritePaths(
        "New-Item -ItemType File -Path 'C:\\Users\\Admin\\Desktop\\ProbeTest.txt' -Force | Format-List"
      )).toContain("C:\\Users\\Admin\\Desktop\\ProbeTest.txt");
    });

    it("extracts New-Item with -ItemType Directory", () => {
      expect(extractWritePaths(
        "New-Item -ItemType Directory -Path C:\\Data\\NewFolder"
      )).toContain("C:\\Data\\NewFolder");
    });

    it("extracts Remove-Item with -Force -Recurse", () => {
      expect(extractWritePaths('Remove-Item -Recurse -Force "C:\\temp\\old"')).toContain("C:\\temp\\old");
    });

    it("extracts Copy-Item destination", () => {
      expect(extractWritePaths('Copy-Item C:\\src\\file.txt -Destination "C:\\dst\\file.txt"'))
        .toContain("C:\\dst\\file.txt");
    });

    it("extracts Move-Item destination", () => {
      expect(extractWritePaths('Move-Item C:\\a\\old.txt -Destination C:\\b\\new.txt'))
        .toContain("C:\\b\\new.txt");
    });
  });

  describe("cmd write commands and aliases", () => {
    it("extracts redirect > target", () => {
      expect(extractWritePaths("echo hello > C:\\output\\log.txt")).toContain("C:\\output\\log.txt");
    });

    it("extracts append >> target", () => {
      expect(extractWritePaths("echo hello >> C:\\output\\log.txt")).toContain("C:\\output\\log.txt");
    });

    it("extracts redirect to quoted path", () => {
      expect(extractWritePaths('echo hello > "C:\\my output\\log.txt"')).toContain("C:\\my output\\log.txt");
    });

    it("extracts mkdir unquoted", () => {
      expect(extractWritePaths("mkdir C:\\new\\folder")).toContain("C:\\new\\folder");
    });

    it("extracts md alias", () => {
      expect(extractWritePaths("md C:\\new\\folder")).toContain("C:\\new\\folder");
    });

    it("extracts del unquoted", () => {
      expect(extractWritePaths("del C:\\temp\\old.txt")).toContain("C:\\temp\\old.txt");
    });

    it("extracts erase alias", () => {
      expect(extractWritePaths("erase C:\\temp\\old.txt")).toContain("C:\\temp\\old.txt");
    });

    it("extracts rmdir with /s", () => {
      expect(extractWritePaths("rmdir /s C:\\temp\\old")).toContain("C:\\temp\\old");
    });

    it("extracts rd alias with /s /q", () => {
      expect(extractWritePaths("rd /s /q C:\\temp\\old")).toContain("C:\\temp\\old");
    });

    it("extracts ren/rename", () => {
      expect(extractWritePaths("ren C:\\data\\old.txt")).toContain("C:\\data\\old.txt");
    });

    it("extracts xcopy destination", () => {
      expect(extractWritePaths("xcopy C:\\src\\files C:\\dst\\backup")).toContain("C:\\dst\\backup");
    });

    it("extracts robocopy destination", () => {
      expect(extractWritePaths("robocopy C:\\src C:\\dst\\mirror")).toContain("C:\\dst\\mirror");
    });
  });

  describe("PowerShell Unix aliases (cp, mv, rm)", () => {
    it("extracts cp destination", () => {
      expect(extractWritePaths("cp C:\\src\\file.txt C:\\dst\\file.txt")).toContain("C:\\dst\\file.txt");
    });

    it("extracts mv destination", () => {
      expect(extractWritePaths("mv C:\\old\\file.txt C:\\new\\file.txt")).toContain("C:\\new\\file.txt");
    });

    it("extracts rm target", () => {
      expect(extractWritePaths("rm C:\\temp\\old.txt")).toContain("C:\\temp\\old.txt");
    });

    it("extracts rm -rf target", () => {
      expect(extractWritePaths("rm -rf C:\\temp\\old")).toContain("C:\\temp\\old");
    });

    it("extracts cp with quoted destination", () => {
      expect(extractWritePaths('cp C:\\src\\file.txt "C:\\my output\\file.txt"')).toContain("C:\\my output\\file.txt");
    });
  });

  describe("download commands (Invoke-WebRequest, curl, wget)", () => {
    it("extracts Invoke-WebRequest -OutFile quoted", () => {
      expect(extractWritePaths('Invoke-WebRequest https://example.com/file.zip -OutFile "C:\\downloads\\file.zip"'))
        .toContain("C:\\downloads\\file.zip");
    });

    it("extracts iwr -OutFile unquoted", () => {
      expect(extractWritePaths("iwr https://example.com/f.zip -OutFile C:\\dl\\f.zip"))
        .toContain("C:\\dl\\f.zip");
    });

    it("extracts curl -o unquoted", () => {
      expect(extractWritePaths("curl https://example.com/data.json -o C:\\output\\data.json"))
        .toContain("C:\\output\\data.json");
    });

    it("extracts wget -O unquoted", () => {
      expect(extractWritePaths("wget https://example.com/pkg.tar.gz -O C:\\dl\\pkg.tar.gz"))
        .toContain("C:\\dl\\pkg.tar.gz");
    });
  });

  describe("Tee-Object", () => {
    it("extracts Tee-Object quoted", () => {
      expect(extractWritePaths('Get-Process | Tee-Object "C:\\logs\\processes.txt"'))
        .toContain("C:\\logs\\processes.txt");
    });

    it("extracts Tee-Object -FilePath unquoted", () => {
      expect(extractWritePaths("Get-Process | Tee-Object -FilePath C:\\logs\\out.txt"))
        .toContain("C:\\logs\\out.txt");
    });
  });

  describe("Export-Csv", () => {
    it("extracts Export-Csv quoted", () => {
      expect(extractWritePaths('Get-Process | Export-Csv "C:\\output\\procs.csv"'))
        .toContain("C:\\output\\procs.csv");
    });

    it("extracts Export-Csv -Path unquoted", () => {
      expect(extractWritePaths("Get-Process | Export-Csv -Path C:\\output\\procs.csv"))
        .toContain("C:\\output\\procs.csv");
    });
  });

  describe("Archive commands", () => {
    it("extracts Expand-Archive -DestinationPath quoted", () => {
      expect(extractWritePaths('Expand-Archive "C:\\dl\\file.zip" -DestinationPath "C:\\output\\extracted"'))
        .toContain("C:\\output\\extracted");
    });

    it("extracts Expand-Archive -DestinationPath unquoted", () => {
      expect(extractWritePaths("Expand-Archive C:\\dl\\file.zip -DestinationPath C:\\output\\extracted"))
        .toContain("C:\\output\\extracted");
    });

    it("extracts Compress-Archive -Destination quoted", () => {
      expect(extractWritePaths('Compress-Archive -Path C:\\src -Destination "C:\\output\\archive.zip"'))
        .toContain("C:\\output\\archive.zip");
    });
  });

  describe("Python write", () => {
    it("extracts open() with 'w' mode", () => {
      expect(extractWritePaths('open("C:\\output\\data.csv", "w")')).toContain("C:\\output\\data.csv");
    });

    it("extracts open() with 'a' mode", () => {
      expect(extractWritePaths('open("C:\\logs\\app.log", "a")')).toContain("C:\\logs\\app.log");
    });

    it("does NOT extract open() with 'r' mode as write", () => {
      expect(extractWritePaths('open("C:\\data\\input.csv", "r")')).not.toContain("C:\\data\\input.csv");
    });
  });

  describe("Node.js fs write", () => {
    it("extracts fs.writeFileSync", () => {
      expect(extractWritePaths('fs.writeFileSync("C:\\out\\file.json"')).toContain("C:\\out\\file.json");
    });

    it("extracts fs.appendFileSync", () => {
      expect(extractWritePaths('fs.appendFileSync("C:\\logs\\app.log"')).toContain("C:\\logs\\app.log");
    });
  });

  describe(".NET write methods", () => {
    it("extracts File::WriteAllText", () => {
      expect(extractWritePaths('[System.IO.File]::WriteAllText("C:\\out\\data.txt"'))
        .toContain("C:\\out\\data.txt");
    });

    it("extracts Directory::CreateDirectory", () => {
      expect(extractWritePaths('[System.IO.Directory]::CreateDirectory("C:\\new\\dir"'))
        .toContain("C:\\new\\dir");
    });
  });

  describe("pipe to write cmdlet", () => {
    it("extracts piped Out-File path", () => {
      const cmd = 'Get-Date -Format "yyyy-MM-dd HH:mm:ss" | Out-File -FilePath "C:\\a\\test.txt" -Encoding UTF8 -Append';
      expect(extractWritePaths(cmd)).toContain("C:\\a\\test.txt");
    });
  });
});

// ── cleanExtractedPath ──

describe("cleanExtractedPath", () => {
  it("strips trailing commas", () => {
    expect(cleanExtractedPath("C:\\a,")).toBe("C:\\a");
  });

  it("strips trailing slashes", () => {
    expect(cleanExtractedPath("C:\\a\\")).toBe("C:\\a");
  });

  it("strips trailing quotes", () => {
    expect(cleanExtractedPath('C:\\a"')).toBe("C:\\a");
  });

  it("strips trailing parens", () => {
    expect(cleanExtractedPath("C:\\a)")).toBe("C:\\a");
  });

  it("resolves glob to parent", () => {
    expect(cleanExtractedPath("C:\\Users\\test\\*.pdf")).toBe(
      path.dirname("C:\\Users\\test\\*.pdf"),
    );
  });

  it("keeps normal paths unchanged", () => {
    expect(cleanExtractedPath("C:\\Users\\test")).toBe("C:\\Users\\test");
  });
});

// ── expandEnvVarsInCmd ──

describe("expandEnvVarsInCmd", () => {
  it("expands $env:TEMP", () => {
    const result = expandEnvVarsInCmd("dir $env:TEMP");
    expect(result).not.toContain("$env:TEMP");
    expect(result).toContain(process.env.TEMP || process.env.TMP || "");
  });

  it("expands %TEMP%", () => {
    const result = expandEnvVarsInCmd("dir %TEMP%");
    expect(result).not.toContain("%TEMP%");
  });

  it("expands $HOME to USERPROFILE", () => {
    const home = process.env.USERPROFILE || "";
    const result = expandEnvVarsInCmd('New-Item -Path "$HOME\\Desktop\\empty.txt"');
    expect(result).toContain(home + "\\Desktop\\empty.txt");
    expect(result).not.toContain("$HOME");
  });

  it("does not expand $HOME without path separator", () => {
    // $HOME alone (not followed by \ or /) should not be expanded
    // to avoid breaking variable names like $HOMEDIR
    const result = expandEnvVarsInCmd("echo $HOME");
    expect(result).toBe("echo $HOME");
  });
});

// ── Integration: shell payload + path extraction ──

describe("integration: extractShellPayload + extractReadPaths", () => {
  it("does not leak shell exe path into results", () => {
    const payload = extractShellPayload(
      "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
      ["-NoProfile", "-Command", "dir C:\\a C:\\b C:\\c"],
    );
    const paths = extractReadPaths(payload);
    expect(paths).not.toContain("C:\\Program");
    expect(paths).toEqual(expect.arrayContaining(["C:\\a", "C:\\b", "C:\\c"]));
  });

  it("handles semicolon-separated Get-ChildItem commands", () => {
    const payload = extractShellPayload("pwsh", [
      "-Command",
      "Get-ChildItem C:\\a -ErrorAction SilentlyContinue; Get-ChildItem C:\\b -ErrorAction SilentlyContinue",
    ]);
    const paths = extractReadPaths(payload);
    expect(paths).toContain("C:\\a");
    expect(paths).toContain("C:\\b");
  });
});

// ── Move-Item with shell wrapper (regression) ──
describe("Move-Item path extraction with shell wrappers", () => {
  it("extracts write path from pwsh -Command Move-Item with quoted paths", () => {
    const payload = extractShellPayload(
      "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
      ["-NoProfile", "-NonInteractive", "-Command",
       "Move-Item 'C:\\Users\\Administrator\\Desktop\\ModelE' 'C:\\Users\\Administrator\\Desktop\\StressTest_Results\\ModelE'"],
    );
    const writePaths = extractWritePaths(payload);
    expect(writePaths).toContain("C:\\Users\\Administrator\\Desktop\\StressTest_Results\\ModelE");
  });

  it("extracts read path (source) from pwsh -Command Move-Item with quoted paths", () => {
    const payload = extractShellPayload(
      "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
      ["-NoProfile", "-NonInteractive", "-Command",
       "Move-Item 'C:\\Users\\Administrator\\Desktop\\ModelE' 'C:\\Users\\Administrator\\Desktop\\StressTest_Results\\ModelE'"],
    );
    const readPaths = extractReadPaths(payload);
    expect(readPaths).toContain("C:\\Users\\Administrator\\Desktop\\ModelE");
  });

  it("extracts from cmd.exe /c powershell -Command Move-Item (nested)", () => {
    const cmd = 'powershell -Command "Move-Item \'C:\\a\\src\' \'C:\\b\\dst\'"';
    const writePaths = extractWritePaths(cmd);
    expect(writePaths).toContain("C:\\b\\dst");
  });

  it("extracts Move-Item with positional args (no -Destination)", () => {
    const writePaths = extractWritePaths("Move-Item C:\\Users\\test\\Desktop\\old C:\\Users\\test\\Desktop\\new");
    expect(writePaths).toContain("C:\\Users\\test\\Desktop\\new");
  });

  it("extracts Move-Item source as read path", () => {
    const readPaths = extractReadPaths("Move-Item C:\\source\\dir C:\\dest\\dir");
    expect(readPaths).toContain("C:\\source\\dir");
  });

  it("extracts Move-Item with $env:USERPROFILE and -Path/-Destination", () => {
    const home = process.env.USERPROFILE || "C:\\Users\\test";
    const cmd = `Move-Item -Path "$env:USERPROFILE\\Desktop\\ModelA" -Destination "$env:USERPROFILE\\Desktop\\StressTest_Results\\ModelA"`;
    const writePaths = extractWritePaths(cmd);
    const readPaths = extractReadPaths(cmd);
    expect(writePaths).toContain(`${home}\\Desktop\\StressTest_Results\\ModelA`);
    expect(readPaths).toContain(`${home}\\Desktop\\ModelA`);
  });

  // Regression: screenshot bug — Move-Item -LiteralPath with .exe file
  // The source .exe path must be extracted as a read path (not treated as an app launch).
  it("extracts Move-Item -LiteralPath .exe source as read path and destination as write path", () => {
    const payload = extractShellPayload(
      "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
      ["-NoProfile", "-NonInteractive", "-Command",
       "powershell", "-NoProfile", "-NonInteractive", "-Command",
       "Move-Item -LiteralPath 'C:\\Users\\yuxwei\\Desktop\\psping64.exe' -Destination 'C:\\Tools\\psping64.exe'"],
    );
    const readPaths = extractReadPaths(payload);
    const writePaths = extractWritePaths(payload);
    expect(readPaths).toContain("C:\\Users\\yuxwei\\Desktop\\psping64.exe");
    expect(writePaths).toContain("C:\\Tools\\psping64.exe");
  });
});

// ── Real-world sandbox probe commands (regression) ──
describe("real-world sandbox probe commands", () => {
  it("New-Item -ItemType File -Path extracts write path via shell payload", () => {
    const payload = extractShellPayload(
      "powershell",
      ["-NoProfile", "-NonInteractive", "-Command",
       "New-Item -ItemType File -Path 'C:\\Users\\Administrator\\Desktop\\ProbeTestPwsh.txt' -Force | Select-Object FullName, Length, LastWriteTime | Format-List"],
    );
    const writePaths = extractWritePaths(payload);
    expect(writePaths).toContain("C:\\Users\\Administrator\\Desktop\\ProbeTestPwsh.txt");
  });

  it("Get-ChildItem -LiteralPath extracts read path, no write path", () => {
    const payload = extractShellPayload(
      "powershell",
      ["-NoProfile", "-NonInteractive", "-Command",
       "Get-ChildItem -LiteralPath 'C:\\Users\\Administrator\\Desktop\\Shortcuts' -Force | Out-Null"],
    );
    const writePaths = extractWritePaths(payload);
    const readPaths = extractReadPaths(payload);
    expect(writePaths).not.toContain("C:\\Users\\Administrator\\Desktop\\Shortcuts");
    expect(readPaths).toContain("C:\\Users\\Administrator\\Desktop\\Shortcuts");
  });

  it("cmd /c type nul > ~\\Desktop\\file expands ~ and extracts write path", () => {
    const home = process.env.USERPROFILE || "C:\\Users\\test";
    const payload = extractShellPayload(
      "cmd",
      ["/c", 'type nul > "~\\Desktop\\ProbeTestPwsh.txt"'],
    );
    const writePaths = extractWritePaths(payload);
    expect(writePaths).toContain(`${home}\\Desktop\\ProbeTestPwsh.txt`);
  });
});
