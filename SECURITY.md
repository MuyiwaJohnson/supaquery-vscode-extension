# Security Policy

## Supported Versions

Use this section to tell people about which versions of your project are
currently being supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take the security of SupaQuery seriously. If you believe you have found a security vulnerability, please report it to us as described below.

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to [INSERT SECURITY EMAIL].

You should receive a response within 48 hours. If for some reason you do not, please follow up via email to ensure we received your original message.

Please include the requested information listed below (as much as you can provide) to help us better understand the nature and scope of the possible issue:

* **Type of issue** (buffer overflow, SQL injection, cross-site scripting, etc.)
* **Full paths of source file(s) related to the vulnerability**
* **The location of the affected source code (tag/branch/commit or direct URL)**
* **Any special configuration required to reproduce the issue**
* **Step-by-step instructions to reproduce the issue**
* **Proof-of-concept or exploit code (if possible)**
* **Impact of the issue, including how an attacker might exploit it**

This information will help us triage your report more quickly.

## Preferred Languages

We prefer all communications to be in English.

## Policy

SupaQuery follows the principle of [Responsible Disclosure](https://en.wikipedia.org/wiki/Responsible_disclosure).

## Recognition

We would like to thank all security researchers and users who report security vulnerabilities to us. Your efforts help us make SupaQuery more secure for everyone.

## Security Best Practices

When using SupaQuery, please follow these security best practices:

1. **Keep your VS Code updated** to the latest version
2. **Review generated SQL** before executing in production
3. **Validate all inputs** before using them in queries
4. **Use parameterized queries** when possible
5. **Follow the principle of least privilege** for database access
6. **Regularly audit** your database permissions and access controls

## Security Considerations

SupaQuery is a development tool that translates queries but does not execute them. However, please be aware that:

- Generated SQL should be reviewed before execution
- HTTP/cURL commands may contain sensitive information
- The extension processes your code locally in VS Code
- No data is sent to external services during translation

## Updates

Security updates will be released as patch versions (e.g., 0.1.1, 0.1.2) and will be announced in the release notes. 