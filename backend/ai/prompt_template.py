from backend.utils.utils import clean
from langchain_core.prompts import ChatPromptTemplate


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
    return f"""
                You are an AI recruitment assistant. Compare the candidate's resume with the job description and evaluate how well the candidate matches the role.

                Follow this evaluation logic strictly:

                SCORING CRITERIA (Total = 100)

                1. Experience Match — 30%

                * Compare the years of experience required in the job description with the candidate's experience.
                * If the difference between required and actual experience is greater than 3 years, treat this as a **senior role mismatch** and give a very low experience score (0–5).
                * If the experience approximately matches, score normally.

                2. Skills Match — 40%

                * Compare technical skills mentioned in the job description with those in the resume.
                * Count both exact matches and closely related technologies.
                * Give higher scores when most required skills are present.

                3. Work / Project Relevance — 20%

                * Evaluate whether the candidate's work experience and projects are relevant to the job description.
                * Consider the complexity, impact, and domain similarity.

                4. Resume Quality — 10%
                Evaluate:

                * Resume structure and clarity
                * Grammar and spelling
                * Professional formatting

                INPUT DATA

                Resume:
                {clean(resume)}

                Job Description:
                {clean(job_description)}

                OUTPUT FORMAT

                Return the result in the following structured JSON Format, no preamble:

                score: <number between 0 and 100>

                matched_skills:

                * skill 1
                * skill 2
                * skill 3

                missing_skills:

                * skill 1
                * skill 2
                * skill 3

                suggestions:

                * suggestion 1
                * suggestion 2
                * suggestion 3

                evaluation_summary:

                * Explain score for each criteria

                Important Rules:

                * Be objective and realistic.
                * Do not inflate the score.
                * If experience mismatch is very large, reduce the score significantly.
                * Focus on skills and real work evidence.

            """


def mail_prompt(candidate_name, company, role, progress):

    return f"""
                You are a professional career assistant helping a candidate manage their job applications.

                Candidate:
                {candidate_name}

                Company:
                {company}

                Role:
                {role}

                Application Stage:
                {progress}

                Write a professional email appropriate for the application stage.

                Stage Guidelines:

                Applied → Write a polite follow-up email asking for an update.

                HR Interview → Write a thank-you email after the HR interview.

                Technical Interview → Write a thank-you email appreciating the technical discussion.

                Final Round → Write an email expressing appreciation and enthusiasm.

                Rejected → Write a polite response thanking them and asking for feedback.

                Offer → Write a response expressing gratitude and interest in discussing offer details.

                Rules:
                - Keep the email concise and professional
                - Include a subject line
                - Include greeting and closing
                - Do not use placeholders
                - Return only the email text
            """


def cover_letter_prompt(candidate_name, resume_summary, projects, education, company, role, job_description):
    return f"""
                You are an expert career assistant specializing in writing strong cover letters for candidates transitioning into a new field.

                Write a professional cover letter tailored to the job description.

                Candidate Information:
                Name: {candidate_name}

                Background:
                The candidate is transitioning into the field of Data Science / Machine Learning / AI.

                Candidate Resume Summary:
                {resume_summary}

                Candidate Projects:
                {projects}

                Education:
                {education}

                Job Information:
                Company: {company}
                Role: {role}

                Job Description:
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


def chatbot_prompt():
    prompt = ChatPromptTemplate.from_messages([
        ("system",
        """
        You are an AI job assistant.
        Response Style:
        - Maximum 400 words
        - Use bullet points
        - Focus only on the most important points

        Resume Context:
        {context}

        Company: {company}
        Role: {role}
        Stage: {progress}
        """
        ),
        ("human","{input}")
    ])

    return prompt