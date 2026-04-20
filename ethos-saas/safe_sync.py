import shutil
import os

source = r'd:\Aplicaciones\Contabilidad\Ethos V.2\ethos-saas'
target = r'd:\Aplicaciones\Contabilidad\Ethos V.2'

folders_to_sync = ['app', 'components', 'lib', 'types', 'scripts', 'supabase'] # EXCLUDED .github
files_to_sync = ['package.json', 'next.config.js', 'tailwind.config.ts', 'tsconfig.json', 'middleware.ts', 'jest.config.js', 'postcss.config.js', '.eslintrc.json', 'PENDING_TASKS.md']

def sync():
    for folder in folders_to_sync:
        s_path = os.path.join(source, folder)
        t_path = os.path.join(target, folder)
        if os.path.exists(s_path):
            print(f'Syncing folder: {folder}')
            if os.path.exists(t_path):
                shutil.rmtree(t_path)
            shutil.copytree(s_path, t_path)
    
    for file in files_to_sync:
        s_path = os.path.join(source, file)
        t_path = os.path.join(target, file)
        # For PENDING_TASKS, we take it from Auditoria if it exists there
        if file == 'PENDING_TASKS.md':
            audit_path = r'd:\Aplicaciones\Contabilidad\Ethos V.2\Auditoria\Ethos\PENDING_TASKS.md'
            if os.path.exists(audit_path):
                s_path = audit_path

        if os.path.exists(s_path):
            print(f'Syncing file: {file}')
            shutil.copy2(s_path, t_path)

if __name__ == "__main__":
    sync()
