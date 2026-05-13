
def check_brackets(filename):
    with open(filename, 'r') as f:
        content = f.read()
    
    stack = []
    for i, char in enumerate(content):
        if char == '{':
            stack.append(i)
        elif char == '}':
            if not stack:
                print(f"Extra closing bracket at index {i}")
                return False
            stack.pop()
    
    if stack:
        print(f"Unclosed brackets at indices {stack}")
        return False
    
    print("Brackets are balanced")
    return True

check_brackets('/Users/shashidharhegde/Documents/GitHub/Maarga_V_2/frontend/src/index.css')
check_brackets('/Users/shashidharhegde/Documents/GitHub/Maarga_V_2/frontend/src/pages/Dashboard.jsx')
check_brackets('/Users/shashidharhegde/Documents/GitHub/Maarga_V_2/frontend/src/pages/JobsPage.jsx')
check_brackets('/Users/shashidharhegde/Documents/GitHub/Maarga_V_2/frontend/src/pages/GeneratorPage.jsx')
check_brackets('/Users/shashidharhegde/Documents/GitHub/Maarga_V_2/frontend/src/App.jsx')
