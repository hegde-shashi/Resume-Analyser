from backend.utils.utils import clean
from langchain_core.prompts import ChatPromptTemplate
import json

def resume_check(text):
    prompt = ChatPromptTemplate.from_template(
        """
            Determine if the following document is a professional resume.

            Return ONLY JSON:

            {{
                "is_resume": true or false
            }}

            Document:
            {text}
        """
    )
    return prompt

def job_description_prompt():
    return ChatPromptTemplate.from_template(
        """
        Extract structured job information from the provided text. Think like a recruiter: prioritize what is most important for the role.

        Return ONLY valid JSON. No preamble.

        Fields and Extraction Rules:
        - job_title: The official title of the role.
        - job_id: Job ID of the role.
        - company: Name of the hiring organization.
        - location: Work location.
        - experience_required: Experience required for the role.
        - skills_required: List only the **Core/Primary Skills**. These are skills mentioned as "Must have", "Required", or mentioned repeatedly as fundamental to the role.
        - preferred_skills: List **Secondary/Nice-to-have Skills**. These are skills mentioned as "Preferred", "Plus", "Desired", "Bonus" or anything similar.
        - responsibilities: Summary of key tasks.
        - education: Degrees or certifications required.
        - job_type: e.g., Full-time, Internship, Contract.

        Job Description Text:
        {job_text}
        """
    )



def compare_prompt(resume, job_description):

    prompt = ChatPromptTemplate.from_template(
        """
            You are an AI recruitment assistant. Compare the candidate's resume with the job description and evaluate how well the candidate matches the role.
            
            ### CORE DIRECTIVES:
            - **Be Hyper-Critical & Precise:** Avoid "safe" or generic scores (like 75, 78, or 80). Every point must be earned through explicit evidence in the resume.
            - **No Default Scoring:** Do not default to a high score just because the candidate is "good". If any core requirement is missing or weak, reflect it aggressively in the score.
            - **Evidence-Based:** Base the score on the **quality** of experience (impact, scale, complexity), not just the mention of keywords.
            - **Mathematical Rigor:** The final score must strictly be the sum of the four category scores.

            ### SCORING CRITERIA (Total = 100)
            
            1. **Experience Match (Max: 30)**
            - **Tenure (15 pts):** Match total years of experience against JD requirements.
            - **Seniority & Level (15 pts):** Evaluate if the candidate has operated at the required seniority level (e.g., Lead vs Senior vs Junior).
            - **CRITICAL RULE:** If the candidate has 2+ years LESS than the required minimum, cap this section at 5 pts.
            - **HARD CAP:** If there is a major seniority mismatch and the JD is NOT flexible, the TOTAL overall score must be below 45.

            2. **Skills Match (Max: 40)**
            - **Core/Must-Have Skills (30 pts):** Deduct 5-10 points for every missing core skill mentioned in the JD.
            - **Preferred/Secondary Skills (10 pts):** Award points only for relevant bonuses.
            - **Usage Context:** Just listing a skill in a "Skills" section is worth half the points of showing its application in a "Experience" project.

            3. **Work / Project Relevance (Max: 20)**
            - **Industry Context (10 pts):** Is their previous experience in a similar or relevant industry/domain?
            - **Complexity & Impact (10 pts):** Evaluate the scale and technical depth of projects. 

            4. **Resume Quality & Professionalism (Max: 10)**
            - **Formatting & ATS (5 pts):** Is the layout professional and readable?
            - **Clarity & Impact (5 pts):** Are bullet points results-oriented and free of fluff?

            ### INPUT DATA
            Resume:
            {resume}

            Job Description:
            {job_description}

            ### OUTPUT FORMAT
            Return ONLY valid JSON:
            {{
                "score": <exact_total_sum_of_categories>,
                "matched_skills": ["explicitly found skills"],
                "missing_skills": ["required but missing skills"],
                "suggestions": ["specific, actionable improvements for this candidate"],
                "evaluation_summary": "#### Evaluation Breakdown\\n- **Experience Match (<score>/30):** <critical explanation of why this specific score was given>\\n- **Skill Match (<score>/40):** <analysis of core vs secondary skill coverage>\\n- **Work / Project Relevance (<score>/20):** <assessment of domain fit and project impact>\\n- **Resume Quality (<score>/10):** <feedback on presentation and wording>"
            }}
            
            **STRICT RULE:** Ensure the score is granular (e.g., 63, 71, 84) based on your calculation. Do not round to common numbers like 70, 75, or 80 unless they truly reflect the data.
        """
    )

    return prompt.format(
        resume=resume,
        job_description=job_description
    )


def mail_prompt(candidate_name, job_description, progress):
    prompt = ChatPromptTemplate.from_template(
        """
        You are a professional career assistant helping a candidate manage their job applications.

        Candidate:
        {candidate_name}

        Job details:
        {job_description}

        Job progress:
        {progress}

        Write a professional email appropriate for the application stage.

        Stage Guidelines:

        Applied -> Write a polite follow-up email asking for an update.

        Assessment -> Write an email regarding the technical assessment or test.

        HR Interview -> Write a thank-you email after the HR interview.

        Technical Interview -> Write a thank-you email appreciating the technical discussion.

        Final Round -> Write an email expressing appreciation and enthusiasm.

        Rejected -> Write a polite response thanking them and asking for feedback.

        Offer -> Write a response expressing gratitude and interest in discussing offer details.

        Rules:
        - Keep the email concise and professional
        - Include a subject line
        - Include greeting and closing
        - Do not use placeholders
        - Return only the email text
        """
    )
    return prompt.format(
        candidate_name=candidate_name,
        job_description=job_description,
        progress=progress
    )


def cover_letter_prompt(candidate_name, resume, job_description):
    prompt = ChatPromptTemplate.from_template(
        """
            You are an expert career assistant specializing in writing strong, tailored cover letters for candidates transitioning into a new field.

            Your task is to write a professional, role-specific cover letter aligned with the provided job description, while clearly positioning the candidate as a strong fit despite a career transition.

            Candidate Information:
            Name: {candidate_name}

            Candidate Resume Summary:
            {resume}

            Job Information:
            {job_description}

            Instructions:

            - Clearly mention the **Job Title** and **Company Name** in the introduction and reinforce them naturally in the body.
            - Emphasize the candidate's most relevant projects, hands-on work, or practical experience as primary evidence of readiness for the role.
            - Highlight the candidate's education, certifications, or formal training as strong academic or foundational preparation.
            - Showcase relevant technical, functional, and analytical skills explicitly mentioned or implied in the job description.
            - Reframe previous professional experience to highlight **transferable skills** such as:
            - Problem-solving
            - Analytical thinking
            - Automation and tooling
            - Process optimization
            - Cross-functional collaboration
            - Data-driven decision-making
            - Clearly explain the candidate's **motivation for transitioning into this new field**, linking it to skills gained, interests developed, and career goals.
            - Align the candidate's skills, experience, and projects directly with the requirements and expectations listed in the job description.
            - Avoid generic claims; back statements with concrete examples from the resume.
            - Do NOT repeat the resume word-for-word—interpret and contextualize it.

            Structure the cover letter as:

            1. **Introduction**: Express interest in the specific role and company, and briefly state the career transition.
            2. **Skills & Projects Paragraph**: Highlight relevant projects, tools, and capabilities aligned with the role.
            3. **Education & Training Paragraph**: Emphasize academic background, certifications, or structured learning relevant to the position.
            4. **Transferable Experience Paragraph**: Reframe prior work experience to show how it directly supports success in the new role.
            5. **Closing Paragraph**: Express enthusiasm, cultural fit, and readiness to contribute value from day one.

            Rules:
            - Maintain a professional, confident, and focused tone.
            - Keep the cover letter between **200-300 words**.
            - Avoid clichés and vague statements.
            - Ensure the letter sounds natural and human, not templated.
            - Return **ONLY the cover letter text** (no explanations, no headings).
        """
    )
    return prompt.format(
        candidate_name=candidate_name,
        resume=resume,
        job_description=job_description
    )


def chat_prompt():

    return ChatPromptTemplate.from_messages([
                    ("system",
                    """
                    ### YOUR CURRENT JOB CONTEXT:
                    - **Company:** {company}
                    - **Role:** {role}
                    - **Stage:** {progress}
                    - **Job Description Details:** {job_description}

                    ### YOUR PERSONALITY & CAPABILITIES:
                    - You are a proactive AI job assistant. You MUST focus on the job context provided above.
                    - **STRICT SCOPE LIMITATION:** You only answer questions related to the Job Description, the target Company, Career Advice, and the user's Resume/Professional background.
                    - **REFUSE OUT-OF-SCOPE REQUESTS:** If the user asks general knowledge questions (e.g., "who is the president", "tell me a joke", "weather", etc.) that are NOT directly linked to their job search or career, politely decline and redirect them back to their career goals.
                    - **NEVER** ask the user for the company name, role, or job details of the current job, as they are already provided in the context above.
                    - If the user asks about the current job, use the **Job Description Details** provided.
                    - Access real-time information via **DuckDuckGo Search** for salaries, reviews, or news.
                    - Use **YouTube Search** for relevant tutorials.
                    - Use **Resume Match** for gap analysis.

                    ### TOOL USAGE (IMPORTANT):
                    - If you need to call a tool that requires `job_id` or `user_id`, use the IDs provided at the end of this message.
                    - DO NOT ask the user for these IDs.

                    Response Style:
                    - Maximum 400 words.
                    - Use bullet points if useful.

                    Context:
                    Resume Context:
                    {context}

                    Previous Conversation:
                    {history_text}
                    """
                    ),
                    ("human","{input}")
                    ])      


def get_resume_structured_prompt(resume_text):
    return f"""

                You are a professional resume writer and ATS optimization expert.

                Using ONLY the provided user data, generate a clean, ATS-friendly resume content structure that improves clarity, grammar, and professional impact while preserving the candidate's original experience.

                Global Constraints:
                - Do NOT add, infer, or fabricate any experience, metrics, tools, roles, or responsibilities.
                - Optimize phrasing for ATS parsing and recruiter readability (semantic matching, not keyword stuffing).

                Rules:
                - Improve grammar, sentence structure, and professional tone throughout.
                - Convert experience, internships, and project descriptions into concise, results-oriented bullet points.
                - Every bullet point MUST begin with a strong past-tense action verb (e.g., Engineered, Optimized, Analyzed, Automated, Delivered).
                - Rephrase generic responsibilities into clear professional accomplishments.
                - Quantify achievements ONLY if the data is already present in the user input (do not create numbers).
                - Use industry-standard terminology relevant to the role indicated by the user data.
                - Prioritize clarity, impact, and relevance over length.
                - Keep formatting simple and ATS-safe (plain text, consistent bullets).
                - Do NOT change Education details or Certificates (only correct spelling or grammar if required).

                Output Rules:
                - Return ONLY valid JSON.
                - Do NOT add explanations, headers, comments, or extra text.
                - Ensure the JSON structure is EXACTLY as specified below

                Return ONLY valid JSON in the following structure:

                {{
                "name": "",
                "mobile_number": "",
                "mail_id": "",
                "linkedin_link": "",
                "github_link": "",
                "portfolio_link": "",
                "summary": "",
                "skills": [
                    {{
                    "main_skill": "",
                    "sub_skills": ""
                    }}
                ],
                "companies": [
                    {{
                    "position": "",
                    "name": "",
                    "from": "",
                    "to": "",
                    "experience": []
                    }}
                ],
                "projects": [
                    {{
                    "title": "",
                    "tools_used": "",
                    "project_link": "",
                    "project_details": []
                    }}
                ],
                "educations": [
                    {{
                    "field": "",
                    "subject": "",
                    "college": "",
                    "college_from": "",
                    "college_to": ""
                    }}
                ],
                "certificates": [
                    {{
                    "name": "",
                    "issuer": ""
                    }}
                ]
                }}

                Resume:
                {resume_text}
            """

def get_form_ai_prompt(data):
    return f"""
                You are a professional resume writer.

                Using the provided user data, generate an ATS-friendly resume structure.

                Rules:
                - Do not add fake experience.
                - Improve grammar, clarity, and professional impact.
                - Convert descriptions into high-impact, results-oriented bullet points.
                - Each bullet point must start with a strong action verb (e.g., "Engineered", "Optimized", "Spearheaded").
                - Where possible, quantify achievements (e.g., "reduced latency by 20%").
                - Rephrase generic tasks into professional accomplishments.
                - Don't change Education details and Certificates, check only spelling and grammar.
                - Return the data in the required JSON structure.

                Return ONLY JSON using this schema:

                {{
                "name": "",
                "mobile_number": "",
                "mail_id": "",
                "linkedin_link": "",
                "github_link": "",
                "portfolio_link": "",
                "summary": "",
                "skills": [
                    {{
                    "main_skill": "",
                    "sub_skills": ""
                    }}
                ],
                "companies": [
                    {{
                    "position": "",
                    "name": "",
                    "from": "",
                    "to": "",
                    "experience": []
                    }}
                ],
                "projects": [
                    {{
                    "title": "",
                    "tools_used": "",
                    "project_link": "",
                    "project_details": []
                    }}
                ],
                "educations": [
                    {{
                    "field": "",
                    "subject": "",
                    "college": "",
                    "college_from": "",
                    "college_to": ""
                    }}
                ],
                "certificates": [
                    {{
                    "name": "",
                    "issuer": ""
                    }}
                ]
                }}

                User data:
                {data}
            """

def get_job_specific_prompt(resume_text, job_description):
    return f"""
                
                You are an expert resume optimizer, ATS specialist, and hiring-manager simulator.

                Your task is to rewrite the provided resume so that it is HIGHLY ATS-FRIENDLY and strongly aligned with the given job description, while preserving the candidate’s original experience, roles, and background.

                Global Constraints:
                - The TOTAL output (all JSON fields combined) must NOT exceed **1500 words**.
                - The resume must be optimized for **ATS semantic matching**, not simple keyword copy-paste.

                Critical ATS Optimization Rules:
                - Do NOT copy sentences verbatim from the job description.
                - Translate job description requirements into equivalent, relevant resume language using:
                - Industry-standard terminology
                - Role-aligned action verbs
                - Skill adjacency and semantic equivalents
                - Ensure keywords from the job description are:
                - Naturally embedded
                - Distributed across Summary, Skills, Experience, and Projects
                - Contextualized through achievements and outcomes
                - Avoid keyword stuffing or unnatural repetition.

                Content Rules:
                - Do NOT invent new roles, companies, projects, achievements, metrics, or tools.
                - Rephrase, reorder, and optimize ONLY the existing resume content.
                - Prioritize the most relevant experience and projects for the target role.
                - Create a concise, punchy, professional summary tailored specifically to the job description.
                - Convert experience and project descriptions into clear, results-driven bullet points.
                - Focus on impact, outcomes, contributions, and problem-solving—not responsibilities.
                - Use strong action verbs and role-appropriate language.
                - Quantify results ONLY if already present in the original resume (do not fabricate metrics).
                - Do NOT modify Education details or Certificates (only fix spelling or grammar if required).

                Formatting Rules (ATS-Safe):
                - Use simple text formatting only.
                - No tables, icons, emojis, symbols, charts, or graphics.
                - Use consistent bullet formatting and clear hierarchy.
                - Avoid abbreviations unless they are industry standard.

                Output Rules:
                - Return **ONLY valid JSON**
                - Do NOT add explanations, commentary, headings, or extra text.
                - Ensure the JSON structure is EXACTLY as specified below.

                JSON Output Structure:

                {{
                "name": "",
                "mobile_number": "",
                "mail_id": "",
                "linkedin_link": "",
                "github_link": "",
                "portfolio_link": "",
                "summary": "",
                "skills": [
                    {{
                    "main_skill": "",
                    "sub_skills": ""
                    }}
                ],
                "companies": [
                    {{
                    "position": "",
                    "name": "",
                    "from": "",
                    "to": "",
                    "experience": []
                    }}
                ],
                "projects": [
                    {{
                    "title": "",
                    "tools_used": "",
                    "project_link": "",
                    "project_details": []
                    }}  
                ],
                "educations": [
                    {{
                    "field": "",
                    "subject": "",
                    "college": "",
                    "college_from": "",
                    "college_to": ""
                    }}
                ],
                "certificates": [
                    {{
                    "name": "",
                    "issuer": ""
                    }}
                ]
                }}


                Resume:
                {resume_text}

                Job Description:
                {job_description}
            """

def get_supervisor_prompt(has_resume: bool, has_jd: bool, has_skill_gap: bool, has_research: bool, has_generated_resume: bool, last_message: str):
    return f"""You are the Supervisor of a multi-agent career guidance system.
            Based on the user's message and current state, decide which specialist agent 
            should handle this request NEXT.

            Available agents:
            - "resume_analyzer" → Parse resume and/or JD, extract skills, compute match score
            - "skill_gap" → Identify missing skills, suggest learning paths
            - "resume_generator" → Create/optimize ATS-friendly resume tailored to JD
            - "research" → Search web for company info, salary data, learning resources
            - "career_advisor" → Give personalized career advice, answer questions conversationally
            - "FINISH" → Task is complete, respond to user

            Current State:
            - Resume parsed: {has_resume}
            - JD parsed: {has_jd}
            - Skill gaps identified: {has_skill_gap}
            - Research done: {has_research}
            - Optimized resume generated: {has_generated_resume}

            User's message: "{last_message}"

            ROUTING RULES:
            1. If user uploads resume/JD and they're not parsed yet → "resume_analyzer"
            2. If resume+JD are parsed but no skill gap analysis → "skill_gap"
            3. If user asks to create/optimize resume and it's NOT generated yet → "resume_generator"
            4. If user asks about company/salary/resources/anything that needs to be researched → "research"
            5. If analysis is done and user needs advice → "career_advisor"
            6. If the requested task is already done → "FINISH"

            Return ONLY the agent name, nothing else.
        """

def get_skill_gap_prompt(resume_content, parsed_jd):
    return f"""
    You are an automated Applicant Tracking System (ATS) evaluation engine.
    Your task is to score a resume against a job description using strict,
    evidence-based, rule-driven logic. You are NOT a human recruiter.

    ────────────────────────────────
    HARD RULES (NON-NEGOTIABLE)
    ────────────────────────────────
    - Score strictly based on explicit evidence present in the resume.
    - Do NOT infer, assume, extrapolate, or guess skills or experience.
    - Missing information = missing skill or experience.
    - Partial mentions earn proportional credit ONLY if clearly stated.
    - Do NOT compensate for missing requirements with strength in other areas.
    - Academic, personal, or open-source projects do NOT count as work experience.
    - Internships count as 0.5x experience unless the JD explicitly overrides this.
    - Unclear or missing dates = experience duration does NOT count.
    - No rounding up of scores.
    - Final score MUST be the exact sum of all category scores.
    - Avoid safe, median, or generous scoring. Every point must be justified.

    ────────────────────────────────
    SCORING CRITERIA (TOTAL = 100)
    ────────────────────────────────

    1. EXPERIENCE MATCH (0-30)
    Evaluate total years of RELEVANT experience and seniority level only.

    Scoring Rules:
    - If resume years < JD minimum → MAX 15 points.
    - If resume years ≥ JD minimum → up to 25 points.
    - If resume years ≥ JD minimum + 2 years → up to 30 points.
    - Seniority mismatch (e.g., junior vs senior role) → -5 points flat.
    - Internships counted at 0.5x duration.
    - Experience unrelated to JD domain earns no credit.

    2. SKILL MATCH (0-50)
    Skills must be explicitly listed OR clearly demonstrated in context.

    Skill Classification:
    - Mandatory skills → 70% of skill score (35 points total)
    - If Important skills mentioned in job→ 20% of skill score (10 points total) otherwise not include this, and divide this points to mandatory skills and nice-to-have skills in proportion to their total points.
    - Nice-to-Have skills → 10% of skill score (5 points total)  If this skills not mentioned in job, then divide this points to mandatory skills and nice-to-have skills in proportion to their total points.

    Deduction Rules:
    - Missing ONE mandatory skill → -8 points.
    - Missing ONE important skill → -3 points.
    - Missing nice-to-have skill → no penalty.
    - Tools, frameworks, and languages count ONLY if explicitly named.
    - Similar technologies do NOT substitute unless stated in the JD.

    3. WORK / PROJECT RELEVANCE (0-25)
    Evaluate relevance, technical depth, scale, and applicability of BOTH
    professional work AND projects.

    Classification Rules:
    - Professional Work: Paid, industry, production-level experience.
    - Projects:
        a) Academic (university/coursework)
        b) Personal (self-initiated)
        c) Open-source / Freelance / Client (non-academic)

    Scoring Formula:
    TOTAL = Work Contribution + Project Contribution (cap at 25)

    A. Professional Work Contribution (0-18)
    - Production systems, real users, or business impact required.
    - Explicit ownership, scale, or complexity needed for higher scores.
    - Internal tools or low-impact work score proportionally lower.

    B. Project Contribution (0-12)
    - Academic projects → MAX 6 points total.
    - Personal projects → MAX 8 points total.
    - Open-source / freelance / real client projects → MAX 12 points.
    - Tutorials, toy apps, or copy-along demos → minimal credit (≤2).

    Absolute Limits:
    - Projects WITHOUT work experience → MAX 12/25.
    - Work WITHOUT projects → MAX 18/25.
    - To exceed 18 points, BOTH relevant work AND strong projects must exist.

    Evidence Requirements:
    - Must explicitly mention technologies, problem scope, and candidate's role.
    - Vague descriptions receive proportional or zero credit.

    4. RESUME QUALITY (0-5)
    ATS usability and clarity ONLY.

    Note: don't add these points(like -8 points for not having some skills, -5 points for seniority mismatch, etc) in the json response, its just for your reference.

    Scoring Rules:
    - ATS-parsable format (clear sections, no tables/images) → +2
    - Clear job titles, dates, and progression → +1
    - Strong keyword alignment with JD → +2

    ────────────────────────────────
    STRICT SUMMARY RULES (FOR evaluation_summary)
    ────────────────────────────────
    - Provide professional, recruiter-style qualitative feedback ONLY.
    - NEVER include mathematical calculations (e.g., do NOT show "10 * -8 = -80").
    - NEVER mention specific point deductions or subtractions (e.g., do NOT mention "-5 points" or "limits score to 15").
    - Focus on the reasoning: Describe the gap (e.g., "Significant missing mandatory skills") instead of showing the math.
    - Use clean, professional language suitable for a candidate to read.

    ────────────────────────────────
    OUTPUT FORMAT (STRICT JSON ONLY)
    ────────────────────────────────
    Return JSON EXACTLY with these keys and NOTHING ELSE:

    {{
    "score": <integer 0-100>,
    "matched_skills": [<list of explicitly matched skill strings>],
    "missing_skills": [<list of missing mandatory/important skill strings>],
    "suggestions": [<actionable, resume-specific improvement points>],
    "evaluation_summary": "#### Evaluation Breakdown
    - **Experience Match (X/30):** <Qualitative justification only. No math/deductions.>
    - **Skill Match (X/50):** <Qualitative justification only. No math/deductions.>
    - **Work / Project Relevance (X/25):** <Qualitative justification only. No math/deductions.>
    - **Resume Quality (X/5):** <Qualitative justification only. No math/deductions.>"
    }}

    ────────────────────────────────
    INPUT DATA
    ────────────────────────────────
    Resume Data:
    {json.dumps(resume_content) if isinstance(resume_content, dict) else resume_content}

    Job Description:
    {json.dumps(parsed_jd) if isinstance(parsed_jd, dict) else parsed_jd}

    ────────────────────────────────
    FINAL DIRECTIVE
    ────────────────────────────────
    Behave strictly as a deterministic ATS parser.
    No leniency. No intuition. No hesitation.
    """

def get_resume_rewrite_prompt(parsed_resume, skill_gap):
    return f"""
                
            You are a professional resume writer and ATS optimization expert with experience across multiple industries and job functions.

            Your task is to generate a highly ATS-friendly resume structure using ONLY the provided user data, while intelligently aligning it with the job description.

            GLOBAL CONSTRAINTS:
            - Do NOT invent, assume, exaggerate, or fabricate experience, responsibilities, tools, metrics, or achievements.
            - Preserve the candidate's actual seniority, scope of work, and credibility.
            - Optimize wording for ATS and recruiters without misleading or harming interview outcomes.

            CRITICAL JD ALIGNMENT RULE (SAFE KEYWORD ENRICHMENT):
            - You MAY add keywords, skills, or terminology from the job description **ONLY IF**:
            - They are logically implied by the candidate's existing experience, projects, or education, AND
            - Adding them does NOT misrepresent what the candidate can reasonably explain in an interview.
            - Examples of acceptable additions:
            - Industry-standard synonyms (e.g., “stakeholder communication” for “client coordination”)
            - Common role expectations already reflected implicitly in the resume
            - Adjacent tools, methods, or practices the candidate demonstrably used (without naming them explicitly before)
            - Examples of NOT allowed additions:
            - New tools, certifications, or technologies not present or clearly implied
            - Seniority-inflating leadership claims
            - Metrics or outcomes not present in the original data
            - Enrichment must be subtle, contextual, and defensible—not keyword stuffing.

            CONTENT RULES:
            - Improve grammar, clarity, and professional tone.
            - Rephrase generic responsibilities into clear, results-oriented accomplishments.
            - Convert all experience and project descriptions into professional bullet points.
            - EVERY bullet point must:
            - Begin with a strong action verb (e.g., Led, Built, Optimized, Analyzed, Delivered, Implemented)
            - Describe WHAT was done and WHY it mattered
            - Be concise, specific, and factual
            - Quantify achievements ONLY if numbers already exist in the user data.
            - Avoid buzzwords, vague claims, and filler phrases.
            - Use neutral, industry-agnostic language suitable for all job types.

            SKILLS SECTION RULES:
            - Organize skills logically by domain or function.
            - Use ATS-recognized, standardized skill naming.
            - Remove redundancy while preserving depth.
            - Add JD-aligned keywords ONLY if they meet the safe enrichment rule above.

            SUMMARY RULES:
            - 3-5 lines maximum.
            - Clearly state professional identity, experience level, and core strengths.
            - Incorporate JD-aligned language only where it naturally fits existing experience.
            - Avoid role-specific hype or unsupported claims.

            EDUCATION & CERTIFICATIONS:
            - Do NOT change factual details.
            - Only correct spelling, grammar, or formatting if required.

            FORMATTING RULES (MANDATORY):
            - ATS-safe plain text formatting.
            - No tables, icons, emojis, symbols, or decorative elements.
            - Consistent bullet style and spacing.
            - Clear hierarchy optimized for ATS parsing.


            SECTION BULLET DENSITY RULES (MANDATORY):

            - EACH full-time role MUST contain **4-8 bullet points**.
            - EACH major project MUST contain **3-6 bullet points**.
            - Bullets must be DISTINCT and cover different aspects such as:
            - Architecture or system design
            - Tools and technologies used
            - Data flow or workflow
            - Optimization or automation
            - Accuracy, performance, or efficiency
            - Business or user impact

            ANTI-SUMMARIZATION RULE:
            - Do NOT consolidate multiple responsibilities into one bullet.
            - If experience includes multiple tools, systems, or outcomes, they MUST be split into separate bullets.
            - Short, precise bullets are preferred over fewer comprehensive bullets.

            FAILURE CONDITION:
            - If a role or project contains fewer bullet points than specified, the output is considered incorrect.

            OUTPUT RULES:
            - You can write upto 2000 words but not exceed it and less than 1500 words.
            - Return ONLY valid JSON.
            - Do NOT include explanations, comments, or extra text.
            - JSON structure must match EXACTLY as below.

                JSON Output Structure:
                {{
                "name": "",
                "mobile_number": "",
                "mail_id": "",
                "linkedin_link": "",
                "github_link": "",
                "portfolio_link": "",
                "summary": "",
                "skills": [
                    {{
                    "main_skill": "",
                    "sub_skills": ""
                    }}
                ],
                "companies": [
                    {{
                    "position": "",
                    "name": "",
                    "from": "",
                    "to": "",
                    "experience": []
                    }}
                ],
                "projects": [
                    {{
                    "title": "",
                    "tools_used": "",
                    "project_link": "",
                    "project_details": []
                    }}
                ],
                "educations": [
                    {{
                    "field": "",
                    "subject": "",
                    "college": "",
                    "college_from": "",
                    "college_to": ""
                    }}
                ],
                "certificates": [
                    {{
                    "name": "",
                    "issuer": ""
                    }}
                ]
                }}

                Resume:
                {json.dumps(parsed_resume)[:5000] if parsed_resume else ''}

                Skill Gap context:
                {json.dumps(skill_gap)[:3000] if skill_gap else ''}
    """

def get_career_advisor_prompt(has_parsed_resume, has_skill_gap_report, research_data, last_msg):
    return f"""
    You are a professional career advisor.
    
    ### STRICT SCOPE:
    - ONLY answer questions related to career advice, job searching, company research, and the candidate's resume.
    - If the user asks anything outside of this scope (general knowledge, trivia, etc.), politely inform them that you are specialized in career guidance and cannot answer those questions.
    
    Context:
    - Resume summary available: {has_parsed_resume}
    - Skill gap report available: {has_skill_gap_report}
    - Research data: {str(research_data)[:500]}
    
    User question: {last_msg}
    """