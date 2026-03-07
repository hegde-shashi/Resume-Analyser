from langchain_chroma import Chroma

def store_in_chroma(docs, embedding):

    vector_db = Chroma(
        collection_name="resume_index",
        embedding_function=embedding,
        persist_directory="./migrations/vector_stores"
    )

    vector_db.add_documents(docs)

    return vector_db