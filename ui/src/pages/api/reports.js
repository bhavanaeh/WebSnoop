import fs from "fs";
import path from "path";

export default function handler(req, res) {
    const { website_id } = req.query;

    if (!website_id) {
        res.status(400).json({ error: "Missing website_id parameter" });
        return;
    }

    const reportsDirectory = path.join(
        process.cwd(),
        "public",
        "reports",
        website_id
    );

    if (!fs.existsSync(reportsDirectory)) {
        res.status(404).json({ error: "Reports not found" });
        return;
    }

    const reportDirs = fs.readdirSync(reportsDirectory);

    // Sort the report directories in ascending order
    reportDirs.sort((a, b) => {
        const reportNumA = parseInt(a.split("-")[1]);
        const reportNumB = parseInt(b.split("-")[1]);
        return reportNumB - reportNumA;
    });

    const reports = [];

    reportDirs.forEach((reportDir) => {
        const reportPath = path.join(reportsDirectory, reportDir);
        if (fs.lstatSync(reportPath).isDirectory()) {
            const filePath = path.join(
                reportPath,
                "focused_accessibility_issues.json"
            );
            if (fs.existsSync(filePath)) {
                const fileData = fs.readFileSync(filePath, "utf8");
                const reportData = JSON.parse(fileData);
                reports.push({
                    reportName: reportDir,
                    issues: reportData,
                });
            }
        }
    });

    res.status(200).json(reports);
}
