import React from "react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Pie } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend);

const PieChart = ({ report }) => {
    // Group issues by issue type and count them
    const groupedIssuesByType = report.issues.reduce((acc, issue) => {
        if (acc[issue.issue_type]) {
            acc[issue.issue_type] += 1;
        } else {
            acc[issue.issue_type] = 1;
        }
        return acc;
    }, {});

    // Prepare the data for the chart
    const chartData = {
        labels: Object.keys(groupedIssuesByType),
        datasets: [
            {
                data: Object.values(groupedIssuesByType),
                backgroundColor: [
                    "#FF6384",
                    "#36A2EB",
                    "#FFCE56",
                    "#8A8A8A",
                    "#FF8A8A",
                    "#8AC688",
                    "#A388FF",
                    "#FF8ACC",
                    "#FFD180",
                    "#8AFFCC",
                ],
            },
        ],
    };

    // Options for the chart
    const options = {
        plugins: {
            legend: {
                position: "right",
            },
        },
    };

    return <Pie data={chartData} options={options} />;
};

export default PieChart;
