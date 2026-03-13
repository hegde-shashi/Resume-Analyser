import time
import logging
from backend.database.db import db
from backend.models.job_model import Jobs
from backend.ai.llm_client import get_llm
from backend.ai.prompt_template import job_description_prompt
import json
import re

def parse_llm_response(text):
    """Clean and parse JSON from LLM response using regex."""
    if not isinstance(text, str):
        text = str(text)
    
    try:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        return json.loads(match.group()) if match else {}
    except Exception:
        return {}

def is_job_valid(parsed):
    """Check if the parsed job data contains at least 3 meaningful core fields."""
    if not parsed:
        return False
    
    core_fields = [
        parsed.get('job_title'),
        parsed.get('company'),
        parsed.get('location'),
        parsed.get('experience_required'),
        parsed.get('skills_required'),
        parsed.get('responsibilities')
    ]
    
    # Filter out None, empty strings, and common 'not found' placeholders
    placeholders = ('none', 'parsing...', 'pending...', 'n/a', 'not found', 'unknown', 'ai is parsing details...')
    filled_count = sum(
        1 for f in core_fields 
        if f and str(f).strip() and str(f).lower() not in placeholders
    )
    
    return filled_count >= 3

def process_job_task(app, job_id, llm_config=None):
    """One-off background task to process a single job immediately."""
    with app.app_context():
        # Try to get the job with a few retries (SQLite might be slow to commit)
        job = None
        for _ in range(3):
            job = Jobs.query.get(job_id)
            if job: break
            time.sleep(1)
            
        if not job or job.is_parsed:
            return

        if not llm_config:
            # Fallback to a stable default model
            llm_config = {"model": "gemini-2.5-flash-lite", "mode": "default"}

        try:
            logging.info(f"Starting immediate parse for job {job_id} using {llm_config.get('model')}")
            llm = get_llm(llm_config)
            chain = job_description_prompt() | llm
            result = chain.invoke({"job_text": job.raw_content})
            parsed = parse_llm_response(result.content)
            
            if parsed:
                # VALIDATION CHECK: If garbage content (too many empty fields), delete the job
                if not is_job_valid(parsed):
                    logging.info(f"Job {job_id} found to be garbage content after parsing. Deleting.")
                    db.session.delete(job)
                    db.session.commit()
                    return

                job.job_title = parsed.get('job_title', job.job_title)
                job.job_id = parsed.get('job_id', job.job_id)
                job.company = parsed.get('company', job.company)
                job.location = parsed.get('location', job.location)
                job.job_type = parsed.get('job_type', job.job_type)
                
                for field in ('skills_required', 'preferred_skills', 'responsibilities', 'education', 'experience_required'):
                    val = parsed.get(field)
                    if isinstance(val, list):
                        job.__setattr__(field, ", ".join(str(i) for i in val))
                    elif val:
                        job.__setattr__(field, str(val))
                
                job.is_parsed = True
                job.error_message = None # Clear any previous error
                job.raw_content = None # Cleanup
                db.session.commit()

                logging.info(f"Successfully parsed job {job_id} in background task.")
            else:
                logging.warning(f"Failed to parse LLM response as JSON for job {job_id}")
        except Exception as e:
            error_text = str(e)
            logging.error(f"Immediate parse failed for job {job_id}: {error_text}")
            job.error_message = error_text
            db.session.commit()
            # The 2-minute worker will pick it up later as a fallback


def process_pending_jobs(app):
    """Background loop to process jobs that weren't parsed immediately."""
    logging.info("Background Job Processor started.")
    while True:
        try:
            with app.app_context():
                pending_jobs = Jobs.query.filter_by(is_parsed=False).all()
                if pending_jobs:
                    logging.info(f"Found {len(pending_jobs)} pending jobs to process.")
                    
                    for i, job in enumerate(pending_jobs):
                        if not job.raw_content:
                            job.is_parsed = True # Nothing to parse
                            db.session.commit()
                            continue
                            
                        try:
                            # Use a stable default model
                            llm = get_llm({"model": "gemini-2.5-flash-lite", "mode": "default"})
                            chain = job_description_prompt() | llm
                            result = chain.invoke({"job_text": job.raw_content})
                            parsed = parse_llm_response(result.content)
                            
                            if parsed:
                                # VALIDATION CHECK: If garbage content (too many empty fields), delete the job
                                if not is_job_valid(parsed):
                                    logging.info(f"Pending Job {job.id} found to be garbage. Deleting.")
                                    db.session.delete(job)
                                    db.session.commit()
                                    continue

                                job.job_title = parsed.get('job_title', job.job_title)
                                job.job_id = parsed.get('job_id', job.job_id)
                                job.company = parsed.get('company', job.company)
                                job.location = parsed.get('location', job.location)
                                job.job_type = parsed.get('job_type', job.job_type)
                                
                                # Convert lists to strings for the DB
                                for field in ('skills_required', 'preferred_skills', 'responsibilities', 'education', 'experience_required'):
                                    val = parsed.get(field)
                                    if isinstance(val, list):
                                        job.__setattr__(field, ", ".join(str(i) for i in val))
                                    elif val:
                                        job.__setattr__(field, str(val))
                                
                                job.is_parsed = True
                                job.error_message = None # Clear on success
                                job.raw_content = None # Clear raw text after success to save DB space
                                db.session.commit()
                                logging.info(f"Successfully processed job ID: {job.id}")

                            else:
                                logging.warning(f"Failed to parse LLM response as JSON for pending job {job.id}")
                                
                                # 1-minute gap ONLY if there are more jobs to process in this batch
                                if i < len(pending_jobs) - 1:
                                    logging.info("Waiting 1 minute before next job...")
                                    time.sleep(60)
                            
                        except Exception as e:
                            error_text = str(e)
                            logging.error(f"Error processing pending job {job.id}: {error_text}")
                            job.error_message = error_text
                            db.session.commit()
                            # On ANY error, we pause for 30s to be safe
                            break

                
        except Exception as e:
            logging.error(f"Background worker error: {e}")
            
        # Wait for 30 seconds before checking again
        time.sleep(30)
