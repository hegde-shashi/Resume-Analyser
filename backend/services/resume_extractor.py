import json
import logging
from backend.ai.llm_client import get_llm

def extract_resume_details(llm, resume_text):
    """
    Extract structured details from resume text including contact info, address, 
    social links, and common application questions.
    """
    
    prompt = f"""
    You are an expert HR data extractor. Extract exactly the following information from the provided resume text into a VALID JSON format.
    If information is missing, use an empty string "" or null for boolean if it can't be inferred.
    
    CRITICAL: Extract the 'address' fully if available. 
    ALSO: Try to infer values for common application questions based on context (e.g., if college is in India, citizenship might be India).
    
    Required Fields:
    - name (Full name)
    - first_name (Only the first/given name)
    - middle_name (Middle name if any, else empty string)
    - last_name (Only the surname/family name)
    - email
    - phone
    - address (Full residential address if found)
    - city
    - state
    - country
    - pincode
    - linkedin_link
    - github_link
    - portfolio_link
    - summary (Professional summary)
    - primary_skills (String: comma-separated list of top skills)
    - education (Array of objects. Keys MUST be exactly: 'college' (ONLY the name of the school/university, NEVER the person's name), 'degree' (e.g., Bachelor's, Master's, B.E., M.Tech), 'field_of_study' (e.g. Computer Science), 'start_date', 'end_date')
    - experience (Array of objects. Keys MUST be exactly: 'company' (Name of the employer), 'position' (Job title), 'start_date', 'end_date', 'description' (Bullet points of work))
    - total_experience_years (Number)
    - is_citizen_of_india (Boolean or null)
    - requires_visa_sponsorship (Boolean or null)
    - languages (Array of strings, e.g. ["English", "Hindi", "Kannada"]. Include the language names the person knows.)
    - gender (Optional, if mentioned)
    
    Resume Text:
    \"\"\"{resume_text}\"\"\"
    
    Return ONLY pure JSON.
    """
    
    try:
        response = llm.invoke(prompt)
        text = response.content.replace('```json', '').replace('```', '').strip()
        # Find first { and last }
        start = text.find('{')
        end = text.rfind('}') + 1
        if start != -1 and end != 0:
            text = text[start:end]
            
        return json.loads(text)
    except Exception as e:
        logging.error(f"Error in extract_resume_details: {e}")
        return {}
