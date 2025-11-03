<?php
// create-group.php
require_once 'db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

// Validar campos requeridos
if (empty($input['user_email']) || empty($input['group_name'])) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Email de usuario y nombre del grupo son requeridos'
    ]);
    exit;
}

$userEmail = filter_var($input['user_email'], FILTER_SANITIZE_EMAIL);
$groupName = trim($input['group_name']);
$description = $input['description'] ?? '';
$color = $input['color'] ?? '#3b82f6';
$newsletters = $input['newsletters'] ?? [];

try {
    // Verificar que el nombre del grupo no esté duplicado para este usuario
    $stmt = $pdo->prepare('
        SELECT id FROM "NewsletterGroup"
        WHERE "userEmail" = $1 AND "groupName" = $2
    ');
    $stmt->execute([$userEmail, $groupName]);

    if ($stmt->fetch()) {
        http_response_code(409);
        echo json_encode([
            'success' => false,
            'error' => 'Ya existe un grupo con este nombre'
        ]);
        exit;
    }

    // Generar ID
    $groupId = generateCuid();

    // Insertar grupo
    $stmt = $pdo->prepare('
        INSERT INTO "NewsletterGroup" (id, "userEmail", "groupName", description, color, "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        RETURNING id
    ');
    $stmt->execute([$groupId, $userEmail, $groupName, $description, $color]);

    // Agregar newsletters al grupo (si se proporcionaron)
    $addedNewsletters = 0;
    if (!empty($newsletters)) {
        $stmt = $pdo->prepare('
            INSERT INTO "NewsletterGroupItem" (id, "groupId", "senderEmail", "senderName", "addedAt")
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT ("groupId", "senderEmail") DO NOTHING
        ');

        foreach ($newsletters as $newsletter) {
            try {
                $itemId = generateCuid();
                $stmt->execute([
                    $itemId,
                    $groupId,
                    $newsletter['sender_email'],
                    $newsletter['sender_name'] ?? null
                ]);
                $addedNewsletters++;
            } catch (PDOException $e) {
                continue;
            }
        }
    }

    echo json_encode([
        'success' => true,
        'message' => 'Grupo creado exitosamente',
        'group' => [
            'id' => $groupId,
            'group_name' => $groupName,
            'description' => $description,
            'color' => $color,
            'newsletters_added' => $addedNewsletters
        ]
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error al crear el grupo: ' . $e->getMessage()
    ]);
}
?>