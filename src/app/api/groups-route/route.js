export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('user_email');

    const response = await fetch(`http://localhost:8000/read-groups.php?user_email=${userEmail}`);
    const data = await response.json();

    return Response.json(data);
}