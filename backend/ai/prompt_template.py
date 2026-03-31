from backend.utils.utils import clean
from langchain_core.prompts import ChatPromptTemplate

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
        You are an expert career assistant specializing in writing strong cover letters for candidates transitioning into a new field.

        Write a professional cover letter tailored to the job description.

        Candidate Information:
        Name: {candidate_name}

        Background:
        The candidate is transitioning into the field of Data Science / Machine Learning / AI.

        Candidate Resume Summary:
        {resume}

        Job Information:
        {job_description}

        Instructions:

        * Emphasize the candidate's machine learning and data science projects as primary evidence of capability.
        * Highlight the candidate's M.Tech in Data Science & Artificial Intelligence as strong academic preparation.
        * Mention relevant technical skills such as Python, machine learning libraries, and data analysis tools.
        * Reframe previous professional experience to highlight transferable skills such as data pipelines, automation, analytical thinking, and problem solving.
        * Clearly explain the candidate's motivation for transitioning into AI/Data Science.
        * Align the candidate's skills and projects with the requirements of the job description.

        Structure the cover letter as:

        1. Introduction expressing interest in the role.
        2. Paragraph highlighting machine learning projects and technical skills.
        3. Paragraph highlighting M.Tech studies and relevant coursework.
        4. Paragraph reframing prior work experience to show transferable technical skills.
        5. Closing paragraph expressing enthusiasm and readiness to contribute.

        Rules:

        * Keep the tone professional and confident.
        * Do not repeat the resume word-for-word.
        * Keep the cover letter between 200-300 words.
        * Avoid generic statements.
        * Return only the cover letter text.
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
                    ### YOUR PERSONALITY & CAPABILITIES:
                    - You are a proactive AI job assistant with access to real-time information via **DuckDuckGo Search**.
                    - **IF THE USER ASKS FOR SALARY, REVIEWS, BENEFITS, OR RECENT NEWS, YOU MUST USE THE `duckduckgo_search` TOOL.**
                    - DO NOT say you cannot browse the web. You have a search tool for this purpose. 
                    - Use **YouTube Search** for videos/tutorials.
                    - Use **Resume Match** for skill gap analysis.

                    Response Style:
                    - Maximum 400 words
                    - Use bullet points if useful

                    Tool Usage & Search Rules:
                    - If the question is about salaries, company culture, or market trends, perform a DuckDuckGo Search and provide the latest available information.
                    - If the user asks for videos, tutorials, or YouTube resources, use the `search_youtube` tool.
                    - If the user asks about skill gaps, resume matching, or job fit, use the `match_resume_job` tool.

                    Restrictions:
                    - If the question is unrelated to careers, jobs, or learning, politely say you can only help with career-related topics.
                    - If no resume is provided for resume-related questions, ask the user to upload one.

                    Context:
                    Resume Context:
                    {context}

                    Company: {company}
                    Role: {role}
                    Job Description: {job_description}
                    Stage: {progress}

                    Previous Conversation:
                    {history_text}
                    """
                    ),
                    ("human","{input}")
                    ])      


def get_resume_structured_prompt(resume_text):
    return f"""
                You are an expert resume parser.

                Your task is to convert the following resume into a structured JSON format.

                Rules:
                - Do not invent any information.
                - Only use data present in the resume.
                - Convert experience and project descriptions into bullet points.
                - Bullet points must be returned as arrays of strings.
                - Don't change Education details and Certificates, check only spelling and grammar.
                - Keep the information concise and ATS-friendly.
                - If a field is missing, return an empty value.

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
                You are an expert resume optimizer.

                Rewrite the resume so it better matches the provided job description while keeping the original experience.

                Rules:
                - Do not invent new roles or experiences, but you are encouraged to rephrase existing ones for maximum relevance.
                - Only rephrase, prioritize, and optimize content that aligns with the target role.
                - Create a punchy, professional summary based on the job description. (Max 2-3 lines).
                - Use high-impact keywords from the job description naturally.
                - Convert experience and project descriptions into professional bullet points using strong action verbs.
                - Focus on "Impact" and "Results" rather than just "Responsibilities".
                - Don't change Education details and Certificates, check only spelling and grammar.
                - Maintain ATS-friendly formatting.

                Return ONLY JSON in this structure:

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