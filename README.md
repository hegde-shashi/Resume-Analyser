# <img src="assets/images/logo.png" width="45" style="border-radius: 8px; vertical-align: middle; margin-right: 12px;"/> Maarga - Optimize Your Career Path



## 🚀 Overview

**Maarga** is a sophisticated, AI-driven platform designed to bridge the gap between job seekers and their dream careers. By leveraging state-of-the-art Large Language Models (LLMs) and Vector Databases, this application provides deep insights into how well your resume matches specific job descriptions, identifies skill gaps, and offers actionable recommendations.


## ✨ Key Features

- **Intelligent Job Scraping**: Automatically fetch and parse job descriptions from various job boards to save time.
- **Advanced Resume Parsing**: Support for PDF and DOCX formats with high-fidelity text extraction.
- **AI-Powered Analysis**: Deep comparison between your resume and job requirements using **Google Gemini**.
- **Interactive AI Chat**: Chat with your resume data and job context to get tailored career advice and interview preparation.
- **Skill Gap Identification**: Visualise exactly which skills you're missing for a specific role.
- **Secure Authentication**: Robust JWT-based authentication to keep your personal career data private.
- **Responsive Dashboard**: A sleek, modern UI built with React that works beautifully across all devices.
- **High-Speed Asynchronous Parsing**: Immediate background parsing for newly saved jobs with high-priority execution for the first link.
- **Smart Garbage Data Filtering**: Automatically detects and deletes jobs with insufficient data (e.g., login pages or search results) to keep your dashboard clean.
- **Chrome Extension**: A companion tool with **Live Polling** that updates in real-time as the AI finishes parsing job details.

## 🛠️ Tech Stack

### Frontend
- **Framework**: React.js
- **Styling**: Vanilla CSS (Modern, Responsive Design)
- **Icons**: Lucide React
- **Routing**: React Router DOM
- **Utilities**: Axios, React Hot Toast, React Markdown

### Backend
- **Framework**: Flask (Python)
- **Database**: PostgreSQL (Production) / SQLite (Local)
- **ORM**: SQLAlchemy
- **Authentication**: JWT (JSON Web Tokens)
- **AI Orchestration**: LangChain
- **LLM**: Google Gemini
- **Vector Store**: ChromaDB
- **Embeddings**: Google Gemini Embeddings

### Chrome Extension (Optional)
- **Manifest Version**: V3
- **Logic**: Vanilla JavaScript
- **API Communication**: Cross-origin requests to the Flask backend
- **Live Updates**: Automatic background polling for real-time parsing status updates
- **Styling**: Custom CSS with a sleek, consistent UI

## ⚙️ Installation & Setup

### Prerequisites
- Python 3.9+
- Node.js 18+
- Google Gemini API Key

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r ../requirements.txt
   ```
4. Configure environment variables in `.env`:
   ```env
   GOOGLE_API_KEY=your_gemini_api_key
   JWT_SECRET_KEY=your_secret_key
   ```
5. Run the server:
   ```bash
   python app.py
   ```

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm start
   ```

### Chrome Extension Setup
1. Open your Chrome browser and navigate to `chrome://extensions/`.
2. Enable **"Developer mode"** in the top right corner.
3. Click **"Load unpacked"**.
4. Select the `Extension` folder from this repository.
5. The Resume Analyser icon should now appear in your browser toolbar.
6. Make sure your local backend is running (`localhost:5001`) for the extension to interact with.

## 🐳 Docker Deployment

The project includes a `dockerfile` for easy containerization.
```bash
docker build -t resume-analyser .
docker run -p 5001:5001 resume-analyser
```

## ☁️ Azure Deployment

The application is optimized for deployment on **Azure App Service**.

### Deployment Steps:
1. **Container Registry**: Push the Docker image to Azure Container Registry (ACR).
2. **App Service**: Create a New "Web App for Containers" in the Azure Portal.
3. **Environment Variables**: Configure the following in the App Service "Configuration" settings:
   - `GOOGLE_API_KEY`: Your Gemini API key.
   - `JWT_SECRET_KEY`: Your JWT secret.
   - `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`: (Optional) for PostgreSQL credentials.
4. **SQLite Compatibility**: The backend includes a `pysqlite3` monkey-patch to ensure compatibility with ChromaDB on Azure's Linux environments.
5. **Persistent Storage**: Ensure you configure a persistent storage mount if using SQLite to keep your data across restarts.


## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

*Built with ❤️ by Shashidhar Hegde*
