<?php
require_once 'db.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];

$groupId = $input['group_id'] ?? null;
$userEmail = $input['user_email'] ?? null;

if (!$groupId || !$userEmail) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'ID de grupo y email de usuario son requeridos']);
    exit;
}

$userEmail = filter_var($userEmail, FILTER_SANITIZE_EMAIL);

// Log para debugging
error_log("UPDATE GROUP - Group ID: $groupId, User: $userEmail");

try {
    // Verificar que el grupo existe y pertenece al usuario
    $stmt = $pdo->prepare('
        SELECT id, "groupName", description, color
        FROM "NewsletterGroup"
        WHERE id = :groupId AND "userEmail" = :userEmail
    ');
    $stmt->execute([
        ':groupId' => $groupId,
        ':userEmail' => $userEmail
    ]);
    $group = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$group) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Grupo no encontrado']);
        exit;
    }

    // Preparar campos a actualizar
    $updates = [];
    $params = [':groupId' => $groupId];

    // Actualizar nombre del grupo
    if (!empty($input['group_name'])) {
        $newName = trim($input['group_name']);

        // Verificar que no exista otro grupo con el mismo nombre
        $checkStmt = $pdo->prepare('
            SELECT id FROM "NewsletterGroup"
            WHERE "userEmail" = :userEmail
            AND "groupName" = :groupName
            AND id != :groupId
        ');
        $checkStmt->execute([
            ':userEmail' => $userEmail,
            ':groupName' => $newName,
            ':groupId' => $groupId
        ]);

        if ($checkStmt->fetch()) {
            http_response_code(409);
            echo json_encode(['success' => false, 'error' => 'Ya existe un grupo con este nombre']);
            exit;
        }

        $updates[] = '"groupName" = :groupName';
        $params[':groupName'] = $newName;
    }

    // Actualizar descripción
    if (array_key_exists('description', $input)) {
        $updates[] = 'description = :description';
        $params[':description'] = $input['description'];
    }

    // Actualizar color
    if (array_key_exists('color', $input)) {
        $updates[] = 'color = :color';
        $params[':color'] = $input['color'];
    }

    if (empty($updates)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'No se proporcionaron campos para actualizar']);
        exit;
    }

    // Agregar updatedAt
    $updates[] = '"updatedAt" = NOW()';

    // Construir y ejecutar la consulta de actualización
    $sql = 'UPDATE "NewsletterGroup" SET ' . implode(', ', $updates) . ' WHERE id = :groupId';

    error_log("UPDATE QUERY: $sql");
    error_log("PARAMS: " . json_encode($params));

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    // Obtener el grupo actualizado con el conteo de newsletters
    $stmt = $pdo->prepare('
        SELECT
            g.id,
            g."groupName",
            g.description,
            g.color,
            g."createdAt",
            g."updatedAt",
            (SELECT COUNT(*) FROM "NewsletterGroupItem" WHERE "groupId" = g.id) AS newsletter_count
        FROM "NewsletterGroup" g
        WHERE g.id = :groupId
    ');
    $stmt->execute([':groupId' => $groupId]);
    $updatedGroup = $stmt->fetch(PDO::FETCH_ASSOC);

    error_log("UPDATE GROUP SUCCESS - Group: " . $updatedGroup['groupName']);

    echo json_encode([
        'success' => true,
        'message' => 'Grupo actualizado exitosamente',
        'group' => $updatedGroup
    ]);

} catch (PDOException $e) {
    error_log("UPDATE GROUP ERROR: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error al actualizar el grupo: ' . $e->getMessage()
    ]);
}
?>