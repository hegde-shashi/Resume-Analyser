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
        Extract structured job information.

        Return ONLY JSON, No any preamble.

        Fields:
        job_title
        job_id
        company
        location
        experience_required
        skills_required
        preferred_skills
        responsibilities
        education
        job_type

        Job Description:
        {job_text}
        """
    )


def compare_prompt(resume, job_description):

    prompt = ChatPromptTemplate.from_template(
        """
            You are an AI recruitment assistant. Compare the candidate's resume with the job description and evaluate how well the candidate matches the role.

            SCORING CRITERIA (Total = 100)

            1. Experience Match — 30%

            * Compare the total years of experience required by the job with the candidate's total experience.
            * CRITICAL RULE: If the candidate has 2 or more years LESS experience than required (e.g., they have 3 years but the job requires 5+), this is a "Seniority Mismatch".
            * In case of a Seniority Mismatch:
                a) The Experience Match score MUST be between 0 and 5 out of 30.
                b) The TOTAL overall score (out of 100) MUST NOT exceed 40. This is a hard cap. The candidate is not senior enough for the role regardless of skills.



            2. Skills Match — 40%

            * Compare technical skills mentioned in the job description with those in the resume.

            3. Work / Project Relevance — 20%

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

    # return f"""
    #             You are an AI career assistant helping a candidate with a specific job application.

    #             Response Style:
    #             - Maximum 400 words
    #             - Use bullet points wherever required
    #             - Focus only on the most important points
    #             - If you dont know the answer, politely say you dont know, don't make it up
    #             - If the question is unrelated, politely say you can only help related to this job
    #             - If no resume is provided, politely say to provide a resume.

    #             Candidate Resume:
    #             {resume}

    #             Job Information:

    #             Job Title: {job.job_title}
    #             Job Link: {job.job_link}
    #             Company: {job.company}
    #             Location: {job.location}
    #             Application Progress: {job.progress}

    #             User Question: {question}
    #         """

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