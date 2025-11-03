<?php
// delete-group.php
require_once 'db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$groupId = $input['group_id'] ?? $_GET['group_id'] ?? null;
$userEmail = $input['user_email'] ?? $_GET['user_email'] ?? null;

if (empty($groupId) || empty($userEmail)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'ID de grupo y email de usuario son requeridos'
    ]);
    exit;
}

try {
    // Verificar que el grupo existe y pertenece al usuario
    $stmt = $pdo->prepare('
        SELECT
            g.*,
            (SELECT COUNT(*) FROM "NewsletterGroupItem" WHERE "groupId" = g.id) as newsletter_count
        FROM "NewsletterGroup" g
        WHERE g.id = $1 AND g."userEmail" = $2
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

    // Eliminar grupo (CASCADE eliminará automáticamente los items)
    $stmt = $pdo->prepare('DELETE FROM "NewsletterGroup" WHERE id = $1');
    $stmt->execute([$groupId]);

    echo json_encode([
        'success' => true,
        'message' => 'Grupo eliminado exitosamente',
        'deleted_group' => [
            'id' => $group['id'],
            'group_name' => $group['groupName'],
            'newsletters_removed' => $group['newsletter_count']
        ]
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error al eliminar el grupo: ' . $e->getMessage()
    ]);
}
?>