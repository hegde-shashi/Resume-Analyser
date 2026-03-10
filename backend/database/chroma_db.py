from langchain_chroma import Chroma
import chromadb
from backend.services.embedding_services import google_embedding
from backend.config import PERSISTENT_DIR
import os

chroma_path = os.path.join(PERSISTENT_DIR, "chroma_db")
client = chromadb.PersistentClient(path=chroma_path)

embedding = google_embedding()


def store_resume_embeddings(chunks, user_id):

    collection_name = f"resume_user_{user_id}"

    vector_store = Chroma(
        collection_name=collection_name,
        embedding_function=embedding,
        client=client
    )

    ids = [f"resume_user_{user_id}_chunk_{i}" for i in range(len(chunks))]

    vector_store.add_texts(
        texts=chunks,
        ids=ids,
        metadatas=[{"user_id": user_id, "type": "resume"} for _ in chunks]
    )

    return collection_name


def get_resume_retriever(user_id):

    collection_name = f"resume_user_{user_id}"

    vector_store = Chroma(
        collection_name=collection_name,
        embedding_function=embedding,
        client=client
    )

    retriever = vector_store.as_retriever(
        search_kwargs={"k": 3}
    )

    return retriever


def delete_resume_embeddings(user_id):

    collection_name = f"resume_user_{user_id}"

    try:
        client.delete_collection(collection_name)
    except:
        pass