import re
import json
import os
import requests
from PIL import Image, ImageDraw, ImageFont
from urllib.parse import urlparse
import subprocess
import sys
import webbrowser
import argparse
import time
import threading 

def install_playwright():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Playwright is not installed. Installing now...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "playwright"])
        subprocess.check_call([sys.executable, "-m", "playwright", "install"])

install_playwright()  # Ensure Playwright is installed before importing
from playwright.sync_api import sync_playwright

def open_browser(url):
    time.sleep(1)
    webbrowser.open_new_tab(url)


def ensure_directory_exists(path):
    if not os.path.exists(path):
        os.makedirs(path)

def sanitize_url(url):
    """ Sanitize the URL to be used as a directory name """
    parsed_url = urlparse(url)
    return re.sub(r'[^a-zA-Z0-9]', '_', parsed_url.netloc)

def check_existing_report(url, reports_dir):
    """ Check if there is an existing report for the URL """
    site_dir = sanitize_url(url)
    report_path = os.path.join(reports_dir, site_dir, "focused_accessibility_issues.json")
    return os.path.exists(report_path), report_path


def send_to_llm_api(issue_type, html_examples, lang):
    
    url = "https://api.perplexity.ai/chat/completions"
    headers = {
        "Authorization": "Bearer <perplexity-api-key>",  
        "Content-Type": "application/json"
    }

    # Creating a detailed prompt for the LLM
    content = f"The following are examples of {issue_type} issues detected in the webpage. For each issue, I've provided the HTML snippet, failure summary, and a brief description. Please analyze the specific code context and provide a targeted, actionable code solution to address the accessibility concern according to WCAG standards. The solution should be tailored to the given code snippet and provided in the {lang.capitalize()} language. Ensure that your solution seamlessly integrates with the existing code structure and directly addresses the identified problem while adhering to best practices for web accessibility. Please return the code solution wrapped in code blocks using the appropriate syntax for the HTML language."

    last_failure_summary = None
    for example in html_examples:
        if example['failureSummary'] != last_failure_summary:
            content += f"\n\nHTML snippet:\n{example['html_snippet']}\n\nFailure Summary: {example['failureSummary']}\n\nDescription: {example['description']}\n\nSolution:"
            last_failure_summary = example['failureSummary']
    print(content)
    prompt = {
        # "model": "mixtral-8x7b-instruct",
        "model": "llama-3-8b-instruct",
        "messages": [
            {
                "role": "system",
                "content": "You are an AI tool designed to assist developers and designers in enhancing the accessibility of their web applications."
            },
            {
                "role": "user",
                "content": content
            }
        ]
    }

    response = requests.post(url, headers=headers, data=json.dumps(prompt))
    if response.status_code == 200:
        json_data = response.json()
        # Extract the message content from the API response
        if json_data['choices']:
            content = json_data['choices'][0]['message']['content']
            return content
        else:
            return "No content available in the response."
    else:
        print("API Error:", response.text)
        return "API request failed."
        
def run_accessibility_check(url, enable_llm_api=False, lang="english"):
    reports_dir = '../ui/public/reports'
    site_dir = sanitize_url(url)
    site_reports_dir = os.path.join(reports_dir, site_dir)
    ensure_directory_exists(site_reports_dir)

    # Get the count of existing reports for the website
    existing_reports = [d for d in os.listdir(site_reports_dir) if d.startswith('report-')]
    report_count = len(existing_reports) + 1

    report_dir = os.path.join(site_reports_dir, f'report-{report_count}')
    ensure_directory_exists(report_dir)
    
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto(url, wait_until='load')
        page.wait_for_timeout(5000)  # Wait for 5 seconds

        script_dir = os.path.dirname(os.path.realpath(__file__))
        axe_path = os.path.join(script_dir, 'axe.min.js')

        with open(axe_path, 'r') as file:
            axe_core = file.read()
        page.evaluate(axe_core)

        full_page_screenshot_path = os.path.join(report_dir, 'full_page_screenshot.png')
        page.screenshot(path=full_page_screenshot_path, full_page=True)
        image = Image.open(full_page_screenshot_path)
        draw = ImageDraw.Draw(image)  # Define draw here after loading the image

        results = page.evaluate("""
        axe.run(document, {
            runOnly: {
                type: 'tag',
                values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
            }
        }).then(results => {
            return results;
        });
        """)

        total_issues_path = os.path.join(report_dir, "total_accessibility_issues.json")
        with open(total_issues_path, "w") as f:
            json.dump(results, f, indent=4)

        timestamp= results.get('timestamp', None)
        
        grouped_issues = {}
        nodes_with_boxes = []
        for violation in results['violations']:
            for node in violation['nodes']:
                element = page.query_selector(node['target'][0])
                html_snippet = node['html']

                if element:
                    html_snippet = element.evaluate("element => element.outerHTML")
                    box = element.bounding_box()
                    draw.rectangle(
                        [(box['x'], box['y']), (box['x'] + box['width'], box['y'] + box['height'])],
                        outline="red", width=3
                    )
                    if violation['id'] not in grouped_issues:
                        grouped_issues[violation['id']] = []
                    grouped_issues[violation['id']].append({
                        "html_snippet": html_snippet,
                        "impact": violation["impact"],
                        "description": violation["description"],
                        "failureSummary": node["failureSummary"]
                    })                        # grouped_issues[violation['id']].append
                    nodes_with_boxes.append((box, html_snippet))

        image.save(full_page_screenshot_path)  # Save the screenshot with bounding boxes
        print("Screenshot taken and saved at:", full_page_screenshot_path)
        focused_results = []
        focused_issues_path = os.path.join(report_dir, "focused_accessibility_issues.json")

        for issue_type, html_examples in grouped_issues.items():
            response_content = ""
            if enable_llm_api:
                response_content = send_to_llm_api(issue_type, html_examples, lang)
            focused_results.append({
                'issue_type': issue_type,
                'code': '\n\n'.join([data['html_snippet'] for data in html_examples]),
                'impact': html_examples[0]['impact'],
                'description': html_examples[0]['description'],
                'failureSummary': '\n'.join([data['failureSummary'] for data in html_examples]),
                'llm_suggestions': response_content,
                "timestamp": timestamp
            })
            with open(focused_issues_path, "w") as f:
                json.dump(focused_results, f, indent=4)

        ui_dir = os.path.join(os.path.dirname(os.path.realpath(__file__)), '..', 'ui')
        os.chdir(ui_dir)

        subprocess.run(["yarn"], check=True)
        subprocess.run(["yarn", "run", "build"], check=True)

        start_process = subprocess.Popen(["yarn", "run", "start"])

        website_id = site_dir
        report_url = f'http://localhost:3000/?website_id={website_id}'
        browser_thread = threading.Thread(target=open_browser, args=(report_url,))
        browser_thread.start()

        browser.close()
    
            
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='This script checks the accessibility of a webpage.')
    parser.add_argument('--url', required=True, help='The URL of the webpage to check.')
    parser.add_argument('--lang', default='english', help='The language of the output. Default is English.')
    parser.add_argument('--serve', action='store_true', help='Skip processing and directly serve the UI.')
    args = parser.parse_args()

    url = args.url
    lang = args.lang
    serve = args.serve
    enable_llm_api = True  # Set this based on your needs

    if serve:
        ui_dir = os.path.join(os.path.dirname(os.path.realpath(__file__)), '..', 'ui')
        os.chdir(ui_dir)

        site_dir = sanitize_url(url)
        start_process = subprocess.Popen(["npm", "run", "start"])

        website_id = site_dir
        report_url = f'http://localhost:3000/?website_id={website_id}'
        browser_thread = threading.Thread(target=open_browser, args=(report_url,))
        browser_thread.start()
        
        start_process.wait()  # Wait for the npm process to finish

    else:
        # Run the accessibility check which also starts the server
        run_accessibility_check(url, enable_llm_api=enable_llm_api, lang=lang)
        
        try:
            while True:
                time.sleep(1)  # Wait indefinitely until the user terminates the script
        except KeyboardInterrupt:
            print("Script terminated by user.")

# python3 main.py --help
# python3 main.py --url=https://courses.grainger.illinois.edu/CS568/sp2024 --lang=english
# Delete the old report directory to re-run the script for the same URL
