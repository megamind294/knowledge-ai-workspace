import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

function xml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export default class PrivacySafeReporter {
  constructor(options = {}) {
    this.outputFile = options.outputFile ?? "test-results/browser-results.xml";
    this.writeLine = options.writeLine ?? ((line) => console.log(line));
    this.results = new Map();
    this.total = 0;
  }

  onBegin(_config, suite) {
    this.results.clear();
    this.total = suite.allTests().length;
    this.writeLine(JSON.stringify({ event: "browser_tests_started", total: this.total }));
  }

  onTestEnd(test, result) {
    const status = ["passed", "failed", "timedOut", "skipped", "interrupted"].includes(result.status)
      ? result.status : "failed";
    this.results.set(test.id, { status, duration: Number.isFinite(result.duration) ? result.duration : 0 });
    this.writeLine(JSON.stringify({ event: "browser_test_finished", status, durationMs: Number.isFinite(result.duration) ? result.duration : 0 }));
  }

  async onEnd(result) {
    const finalResults = [...this.results.values()];
    const failures = finalResults.filter(({ status }) => status !== "passed" && status !== "skipped").length;
    const skipped = finalResults.filter(({ status }) => status === "skipped").length;
    const cases = finalResults.map(({ status, duration }, index) => {
      const failure = status !== "passed" && status !== "skipped" ? `<failure type="${xml(status)}"/>` : "";
      const skip = status === "skipped" ? "<skipped/>" : "";
      return `<testcase name="browser-check-${index + 1}" time="${duration / 1000}">${failure}${skip}</testcase>`;
    }).join("");
    const document = `<?xml version="1.0" encoding="UTF-8"?><testsuite name="browser-smoke" tests="${finalResults.length}" failures="${failures}" skipped="${skipped}">${cases}</testsuite>`;
    await mkdir(dirname(this.outputFile), { recursive: true });
    await writeFile(this.outputFile, document, "utf8");
    this.writeLine(JSON.stringify({ event: "browser_tests_finished", status: result.status, total: finalResults.length, failures, skipped }));
  }
}
