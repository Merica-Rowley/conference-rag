import json
from supabase import create_client

# 1. Load the public configuration
with open('config.public.json', 'r') as f:
    public_config = json.load(f)

SUPABASE_URL = public_config['SUPABASE_URL']
SUPABASE_ANON_KEY = public_config['SUPABASE_ANON_KEY']

# 2. Create the Supabase client using ONLY the anon key
print("\n🔑 Initializing Supabase client with the ANON key...")
client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

# 3. Test querying the page_views table
print("\n--- Test 1: Query 'page_views' ---")
try:
    # The page_views table has a policy allowing 'anon' and 'authenticated' to read
    response = client.table('page_views').select('*').limit(5).execute()
    print("✅ Success! The anon key is allowed to read 'page_views'.")
    print(f"   Rows returned: {len(response.data)}")
except Exception as e:
    print(f"❌ Error querying page_views: {e}")

# 4. Test querying the sentence_embeddings table
print("\n--- Test 2: Query 'sentence_embeddings' ---")
try:
    # The sentence_embeddings table only allows 'authenticated' users to read
    response = client.table('sentence_embeddings').select('*').limit(5).execute()
    print("✅ Query executed successfully.")
    print(f"   Rows returned: {len(response.data)}")
    
    if len(response.data) == 0:
        print("   -> 🔒 As expected! RLS silently filtered the results because the anon key is not authenticated.")
    else:
        print("   -> ⚠️ WARNING: Data was returned! RLS might not be configured correctly.")
except Exception as e:
    print(f"❌ Error querying sentence_embeddings: {e}")
print("\n")
