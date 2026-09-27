STOP LOSING TALENT — GITHUB PAGES DEPLOYMENT

This ZIP contains the complete static website. Keep all files together in the
repository root so the relative links between pages continue to work.

DEPLOYMENT
1. Create a new GitHub repository.
2. Extract this ZIP.
3. Upload every extracted file to the repository root.
4. In GitHub, open Settings > Pages.
5. Under Build and deployment, choose "Deploy from a branch."
6. Select the main branch and the /(root) folder, then save.
7. After GitHub publishes the site, connect stoplosingtalent.com using the
   Custom domain field in GitHub Pages and follow GitHub's DNS instructions.

FORM / EMAIL CONNECTION
The diagnostics work without a server and preserve results in the visitor's
browser. Until an email service is connected, the results form opens a prepared
email in the visitor's email program.

To connect a form-processing service, edit form-config.js:

window.SLT_FORM_ENDPOINT = "YOUR_HTTPS_FORM_ENDPOINT";
window.SLT_TEAM_EMAIL = "hello@stoplosingtalent.com";
window.SLT_FEEDBACK_ENDPOINT = "YOUR_SECURE_FEEDBACK_ENDPOINT";

The endpoint will receive JSON containing the visitor's contact information and
the completed health and/or retirement diagnostic results. Confirm your chosen
provider's expected field format before launch.

PRIMARY FILES
- index.html: main landing page
- diagnostic.html: health/retirement starting question
- benefits.html: healthcare diagnostic and FTE estimator
- retirement.html: retirement-plan diagnostic
- workplace.html: workplace and management diagnostic
- feedback.html: confidential employee feedback interface
- results.html: combined results and contact form
- form-config.js: contact and secure-feedback endpoint configuration

CONFIDENTIAL EMPLOYEE FEEDBACK
GitHub Pages cannot enforce single-use invitations or store confidential
responses by itself. The feedback endpoint must validate campaign and token,
reject a previously used token, store identity separately from answers, and
return only aggregated reporting once the minimum response threshold is met.
Until that endpoint is configured, the employee submission button remains
disabled and the page operates in preview mode.

IMPORTANT
The diagnostic content is educational and does not replace legal, tax,
insurance, investment, actuarial, or fiduciary advice.
