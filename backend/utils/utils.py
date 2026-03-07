def clean(text):
    text = str(text).replace("\t", " ")
    text = re.sub(r" +", " ", text)
    return text.strip()