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
            Be objective and critical. Do not hesitate to give low scores if the candidate is not a good fit, but you must always provide a clear, logical reason for every score assigned.


            SCORING CRITERIA (Total = 100)

            1. Experience Match — 30%

            * Compare the total years of experience required by the job with the candidate's total experience.
            * CRITICAL RULE: If the candidate has 2 or more years LESS experience than required (e.g., 3 years exp for a 5+ year role), this is a "Seniority Mismatch".
            * Handling Seniority Mismatch:
                a) The Experience Match score MUST be low (0 to 5 out of 30) because the tenure requirement is not met.
                b) SCORE CAP & FLEXIBILITY:
                   - If the Job Description explicitly states that "Experience is not a limiting factor for exceptional talent." or similar flexible language: Do NOT apply a hard cap on the total score. Evaluate the candidate's Skills and Projects fairly; if they are truly exceptional, the total score can be high despite the low experience score. But the experience score should be low. Also the total score should not be more than 60.
                   - If NO such flexible language exists: The TOTAL overall score (out of 100) MUST NOT exceed 30. This is a hard cap.

            2. Skills Match — 40%

            * DO NOT perform 1:1 keyword matching. Instead, identify the **Core vs. Secondary Skills** in the Job Description based on emphasis and frequency of mention.
            * Prioritize weightage based on JD emphasis. For example, if SQL is mentioned as the "primary requirement" or appears three times, it is worth more than a skill mentioned once in a "nice to have" list.
            * Missing a core/heavily-emphasized skill should result in a much larger score deduction than missing a secondary skill.
            * Evaluate the *context* of skills: A skill listed in a "Skills" section is worth less than a skill proven through years of application in the "Experience" section.

            3. Work / Project Relevance — 20%

            * Check Summary, Projects and Experience section for relevant skills.
            * Look for specific evidence where the candidate applied the JD's most important skills in high-impact projects or previous roles.
            * If the JD is for a Data Scientist role but the projects are purely Web Development, the score should be low even if the tech stack (e.g., Python) overlaps. Relevance of *domain* and *responsibility* is key.

            4. Resume Quality — 10%

            INPUT DATA

            Resume:
            {resume}

            Job Description:
            {job_description}

            OUTPUT FORMAT
                    Return ONLY valid JSON:
                        "score": <number 0-100>,
                        "matched_skills": ["skill 1", "skill 2"],
                        "missing_skills": ["skill 1", "skill 2"],
                        "suggestions": ["suggestion 1", "suggestion 2"],
                        "evaluation_summary": "- **Experience Match (<score>/30):** <explanation>\\n- **Skill Match (<score>/40):** <explanation>\\n- **Work / Project Relevance (<score>/20):** <explanation>\\n- **Resume Quality (<score>/10):** <explanation>"
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