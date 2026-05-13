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
    - mail_id
    - mobile_number
    - address (Full residential address if found)
    - city
    - state
    - country
    - pincode
    - linkedin_link
    - github_link
    - portfolio_link
    - summary (Professional summary)
    - skills (Array of objects with keys: 'main_skill' (category) and 'sub_skills' (comma separated list))
    - education (Array of objects. Keys MUST be exactly: 'college', 'degree', 'field_of_study', 'start_date', 'end_date')
    - experience (Array of objects. Keys MUST be exactly: 'company', 'position', 'start_date', 'end_date', 'description' (Bullet points))
    - projects (Array of objects. Keys MUST be exactly: 'title', 'tools_used', 'project_link', 'project_details' (Bullet points))
    - certificates (Array of objects. Keys MUST be exactly: 'name', 'issuer')
    - total_experience_years (Number)
    - is_citizen_of_india (Boolean or null)
    - requires_visa_sponsorship (Boolean or null)
    - languages (Array of strings)
    - gender (Optional)
    
    Resume Text:
    \"\"\"{resume_text}\"\"\"
    
    Return ONLY pure JSON.
    """
    
    try:
        response = llm.invoke(prompt)
        content = response.content
        if isinstance(content, list):
            content = " ".join([str(c.get('text', c)) if isinstance(c, dict) else str(c) for c in content])
        if not isinstance(content, str):
            content = str(content)
        text = content.replace('```json', '').replace('```', '').strip()
        # Find first { and last }
        start = text.find('{')
        end = text.rfind('}') + 1
        if start != -1 and end != 0:
            text = text[start:end]
            
        return json.loads(text)
    except Exception as e:
        logging.error(f"Error in extract_resume_details: {e}")
        raise e
