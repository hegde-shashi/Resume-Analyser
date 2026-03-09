def build_job_context(job):

    return f"""
            Job Title: {job.job_title}

            Company: {job.company}

            Location: {job.location}

            Experience Required: {job.experience_required}

            Required Skills:
            {job.skills_required}

            Preferred Skills:
            {job.preferred_skills}

            Responsibilities:
            {job.responsibilities}

            Education Requirements:
            {job.education}

            Job Type:
            {job.job_type}
    """