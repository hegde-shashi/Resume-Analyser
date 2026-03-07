from langchain_unstructured import UnstructuredLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

def get_resume_text(file_path):

    loader = UnstructuredLoader(file_path)

    docs = loader.load()

    minimal_docs = []
    for doc in docs:
        src = doc.metadata.get('source')
        minimal_docs.append(
            Document(
                page_content=doc.page_content,
                metadata={'source': src}
            )
        )

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=150,
    )
    text_chunk = text_splitter.split_documents(minimal_docs)
    return text_chunk

