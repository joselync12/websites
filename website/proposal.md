# Cybersecurity Problem & Website Proposal

**Student:** Joselyn
**Major:** Information Technology
**University:** Kean University
**Date:** October 2026

---

## 1. Website Concept

A personal portfolio website for an Information Technology student that showcases skills, interests, and cybersecurity awareness. The site features a space theme and includes a dedicated section on phishing awareness to educate visitors about one of the most common and impactful cyber threats. The website also includes an interactive chatbox to engage visitors and answer common questions.

---

## 2. Target Users

- **Professors and academic advisors** — reviewing student work and progress
- **Potential employers and internship recruiters** — evaluating skills and professionalism
- **Classmates and peers** — connecting and sharing interests
- **General visitors** — anyone looking to learn about phishing awareness and cybersecurity best practices

---

## 3. Functional Requirements

| Requirement | Description |
|-------------|-------------|
| Multi-page navigation | 4 pages: Home, About Me, Tech Interests, Cybersecurity Awareness |
| Responsive layout | Works on desktop, tablet, and mobile devices |
| Interactive chatbox | Rule-based FAQ bot that answers common questions |
| Space theme design | Dark background, starfield effect, purple/teal accents |
| Clean content presentation | Professional display of personal and academic information |
| No user accounts | Static site with no login or data collection |

---

## 4. Security Requirements

| Requirement | Description |
|-------------|-------------|
| No sensitive information | No address, phone number, student ID, passwords, or financial data displayed |
| No input forms | No forms that collect user input, eliminating injection risks |
| No external dependencies | No third-party scripts, libraries, or CDN resources |
| HTTPS | Deployed via GitHub Pages with encrypted transit |
| Client-side only | All functionality runs in the browser; no server-side processing |
| XSS prevention | All chatbot responses are plain text; no user input rendered as HTML |
| No data collection | Conversations in the chatbox are not stored or transmitted |

---

## 5. Potential Threats

| Threat | Likelihood | Impact | Mitigation |
|--------|-----------|--------|------------|
| Information leakage | Low | High | Only share appropriate, non-sensitive content |
| XSS (Cross-Site Scripting) | Very Low | Medium | No user input forms; static content only |
| Supply chain attacks | Very Low | Medium | No external libraries or CDN dependencies |
| Phishing/social engineering | Low | Medium | Limit shared contact info to professional email only |
| Unauthorized access | Very Low | Medium | GitHub's built-in access controls; no admin panel |
| Data breach | Very Low | High | No user data collected or stored |

---

## 6. Research Question

> *How can a personal website raise awareness about phishing attacks and help visitors recognize and avoid common social engineering tactics?*

---

## 7. Project Objectives

1. **Build a multi-page static website** using HTML, CSS, and JavaScript
2. **Demonstrate cybersecurity awareness** through a dedicated phishing education section
3. **Present personal and academic information** in a professional, engaging manner
4. **Create a responsive, accessible user experience** that works across devices
5. **Implement an interactive chatbox** using rule-based logic to engage visitors
6. **Apply security best practices** by minimizing attack surface (no forms, no external dependencies, no sensitive data)
7. **Deploy the site** using GitHub Pages with HTTPS for secure access

---

## 8. Technology Stack

| Layer | Technology |
|-------|-----------|
| Markup | HTML5 |
| Styling | CSS3 (custom, no frameworks) |
| Interactivity | Vanilla JavaScript (no libraries) |
| Hosting | GitHub Pages (free, HTTPS-enabled) |
| Version Control | Git |

---

## 9. Website Structure

```
website/
├── index.html          — Home (intro, interests, fun fact)
├── about.html          — About Me (education, hobbies, skills, goals)
├── interests.html      — Tech Interests (6 areas + reflection questions)
├── cybersecurity.html  — Cybersecurity Awareness (phishing focus)
├── styles.css          — Shared styles (space theme, chatbox, starfield)
├── script.js           — Chatbox logic + starfield effect
└── proposal.md         — This document
```

---

## 10. Conclusion

This website serves as both a personal portfolio and a demonstration of cybersecurity awareness. By focusing on phishing — one of the most prevalent threats facing internet users today — the site educates visitors while showcasing the builder's technical skills and security mindset. The minimalist, dependency-free approach ensures the site is fast, secure, and accessible to all.
