import Image from "next/image";
import { Inter } from "next/font/google";
import {
    Tabs,
    TabList,
    TabPanels,
    Tab,
    TabPanel,
    Text,
    Accordion,
    AccordionItem,
    AccordionButton,
    AccordionPanel,
    AccordionIcon,
    Box,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import useSWR from "swr";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { tomorrow } from "react-syntax-highlighter/dist/cjs/styles/prism";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import PieChart from "@/components/PieChart";
import { Badge } from "@chakra-ui/react";
import { Button, ButtonGroup } from "@chakra-ui/react";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

function reverseArr(input) {
    var ret = new Array();
    for (var i = input.length - 1; i >= 0; i--) {
        ret.push(input[i]);
    }
    return ret;
}

// Helper function to group issues by report name and count them
const groupIssuesByReport = (data) => {
    const grouped = {};

    reverseArr(data).forEach((report) => {
        grouped[report.reportName] = report.issues.length;
    });
    return grouped;
};

const inter = Inter({ subsets: ["latin"] });

const fetcher = (url) => fetch(url).then((res) => res.json());

const CodeBlock = ({ children }) => {
    const codeString = Array.isArray(children) ? children.join("") : children;
    const language = codeString.match(/```(\w+)/)?.[1] || "";
    const code = codeString.replace(/```\w+\n/, "").replace(/```/g, "");

    return (
        <SyntaxHighlighter language="html" style={tomorrow}>
            {code}
        </SyntaxHighlighter>
    );
};

function calculateImpactScore(issues) {
    const weights = {
        critical: 3,
        serious: 2,
        minor: 1,
    };

    let totalScore = 0;
    let totalWeight = 0;

    issues.forEach((issue) => {
        const { impact } = issue;
        const weight = weights[impact];

        if (weight) {
            totalScore += weight;
            totalWeight += weights[impact];
        }
    });

    if (totalWeight === 0) {
        return 0;
    }

    const impactScore = (totalScore / totalWeight) * 100;
    return Math.round(impactScore);
}

export default function Home() {
    const router = useRouter();
    const { website_id } = router.query;
    const {
        data = [],
        isLoading,
        error,
    } = useSWR(
        website_id ? `/api/reports?website_id=${website_id}` : null,
        fetcher
    );

    if (!website_id) {
        return (
            <main className={`min-h-screen p-5 ${inter.className}`}>
                <Text fontSize="xl" fontWeight="" className="mb-4">
                    Web Accessibility Report
                </Text>
                <Text fontWeight="" className="mb-4">
                    Please run the script to generate a new report.
                </Text>
            </main>
        );
    }

    if (error) {
        return <div>Failed to load reports</div>;
    }

    if (isLoading) {
        return <div>Loading...</div>;
    }
    const groupedIssuesByReport = groupIssuesByReport(data);

    // Prepare the data for the chart
    const chartData = {
        labels: Object.keys(groupedIssuesByReport),
        datasets: [
            {
                label: "Number of Issues",
                data: Object.values(groupedIssuesByReport),
                fill: false,
                borderColor: "rgba(75,192,192,1)",
                tension: 0.4, // Add this line to curve the graph edges
            },
        ],
    };

    const latestReport = data[0];
    console.log(calculateImpactScore(latestReport.issues));
    return (
        <main className={`min-h-screen p-5 ${inter.className}`}>
            <div className="w-full flex justify-between">
                <Text fontSize="xl" fontWeight="" className="">
                    Web Accessibility Report
                </Text>
            </div>
            <Text fontSize={12}>{website_id}</Text>
            <div className="flex gap-10 text-center  w-full items-center -mt-5 ">
                <div className="w-1/3 mb-10">
                    {data && <Line data={chartData} />}
                    <Text fontSize={12} className="mt-3">
                        Issues over time
                    </Text>
                </div>
                <div className="w-1/3 mb-10">
                    {data && <PieChart report={latestReport} />}
                    <Text fontSize={12} className=" -mt-4 -ml-28">
                        Distribution of Issues
                    </Text>
                </div>
            </div>
            <Accordion allowMultiple defaultIndex={[0]}>
                {data.map((report, index) => (
                    <AccordionItem
                        key={index}
                        className="bg-slate-50  mb-4 border-solid border-1 border border-slate-400"
                    >
                        <h2>
                            <AccordionButton className="bg-slate-200">
                                <Box as="span" flex="1" textAlign="left">
                                    {report.reportName}
                                </Box>

                                {/* <Badge colorScheme="blue">Score: 10</Badge> */}

                                <AccordionIcon />
                            </AccordionButton>
                        </h2>
                        <AccordionPanel pb={4}>
                            <a
                                href={`/reports/${website_id}/${report.reportName}/full_page_screenshot.png`}
                                target="_blank"
                            >
                                <Button
                                    colorScheme="teal"
                                    size="sm"
                                    className="mb-3"
                                >
                                    View Report Screenshot
                                </Button>
                            </a>
                            {report.issues.map((issue, issueIndex) => (
                                <Box key={issueIndex} mb={4}>
                                    <Text fontWeight="bold" mb={2}>
                                        Issue Type: {issue.issue_type}
                                    </Text>
                                    <Text fontWeight="bold" mb={2}>
                                        Code:
                                    </Text>
                                    <CodeBlock>{issue.code}</CodeBlock>

                                    <Text fontWeight="bold" mt={4} mb={2}>
                                        Recommendations:
                                    </Text>
                                    <Text
                                        whiteSpace="pre-wrap"
                                        as="div"
                                        className="llm-suggestions"
                                    >
                                        {issue.llm_suggestions
                                            .split("```")
                                            .map((block, i) =>
                                                i % 2 === 0 ? (
                                                    <Text key={i}>{block}</Text>
                                                ) : (
                                                    <CodeBlock
                                                        key={i}
                                                    >{`\`\`\`${block}\`\`\``}</CodeBlock>
                                                )
                                            )}
                                    </Text>
                                </Box>
                            ))}
                        </AccordionPanel>
                    </AccordionItem>
                ))}
            </Accordion>
        </main>
    );
}
