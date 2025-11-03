<?php
// update-group.php
require_once 'db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

if (empty($input['group_id']) || empty($input['user_email'])) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'ID de grupo y email de usuario son requeridos'
    ]);
    exit;
}

$groupId = $input['group_id'];
$userEmail = filter_var($input['user_email'], FILTER_SANITIZE_EMAIL);

try {
    // Verificar que el grupo existe y pertenece al usuario
    $stmt = $pdo->prepare('
        SELECT * FROM "NewsletterGroup"
        WHERE id = $1 AND "userEmail" = $2
    ');
    $stmt->execute([$groupId, $userEmail]);
    $group = $stmt->fetch();

    if (!$group) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'error' => 'Grupo no encontrado'
        ]);
        exit;
    }

    // Construir query de actualización
    $updates = [];
    $params = [$groupId];
    $paramIndex = 2;

    if (isset($input['group_name']) && !empty($input['group_name'])) {
        // Verificar que no haya otro grupo con ese nombre
        $stmt = $pdo->prepare('
            SELECT id FROM "NewsletterGroup"
            WHERE "userEmail" = $1 AND "groupName" = $2 AND id != $3
        ');
        $stmt->execute([$userEmail, $input['group_name'], $groupId]);

        if ($stmt->fetch()) {
            http_response_code(409);
            echo json_encode([
                'success' => false,
                'error' => 'Ya existe un grupo con este nombre'
            ]);
            exit;
        }

        $updates[] = '"groupName" = $' . $paramIndex;
        $params[] = trim($input['group_name']);
        $paramIndex++;
    }

    if (isset($input['description'])) {
        $updates[] = 'description = $' . $paramIndex;
        $params[] = $input['description'];
        $paramIndex++;
    }

    if (isset($input['color'])) {
        $updates[] = 'color = $' . $paramIndex;
        $params[] = $input['color'];
        $paramIndex++;
    }

    if (empty($updates)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'No se proporcionaron campos para actualizar'
        ]);
        exit;
    }

    // Agregar updatedAt
    $updates[] = '"updatedAt" = NOW()';

    // Ejecutar actualización
    $sql = 'UPDATE "NewsletterGroup" SET ' . implode(', ', $updates) . ' WHERE id = $1';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    // Obtener grupo actualizado
    $stmt = $pdo->prepare('
        SELECT
            g.*,
            (SELECT COUNT(*) FROM "NewsletterGroupItem" WHERE "groupId" = g.id) as newsletter_count
        FROM "NewsletterGroup" g
        WHERE g.id = $1
    ');
    $stmt->execute([$groupId]);
    $updatedGroup = $stmt->fetch();

    echo json_encode([
        'success' => true,
        'message' => 'Grupo actualizado exitosamente',
        'group' => $updatedGroup
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error al actualizar el grupo: ' . $e->getMessage()
    ]);
}
?>