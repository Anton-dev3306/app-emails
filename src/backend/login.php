<?php
// login.php
require_once 'db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

// Validar campos requeridos
if (empty($input['email']) || empty($input['password'])) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Email y contraseña son requeridos'
    ]);
    exit;
}

$email = filter_var($input['email'], FILTER_SANITIZE_EMAIL);
$password = $input['password'];

try {
    // Buscar usuario por email (usando marcador con nombre)
    $stmt = $pdo->prepare("SELECT * FROM users WHERE email = :email");
    $stmt->execute([':email' => $email]);
    $user = $stmt->fetch();

    // Verificar existencia de usuario
    if (!$user) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'error' => 'Credenciales incorrectas'
        ]);
        exit;
    }

    // Verificar contraseña
    if (!password_verify($password, $user['password'])) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'error' => 'Credenciales incorrectas'
        ]);
        exit;
    }

    // Login exitoso — eliminar el hash antes de responder
    unset($user['password']);

    echo json_encode([
        'success' => true,
        'message' => 'Login exitoso',
        'user' => $user
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error en el servidor: ' . $e->getMessage()
    ]);
}
?>
