<?php
require_once 'db.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$groupId = $input['group_id'] ?? $_GET['group_id'] ?? null;
$userEmail = $input['user_email'] ?? $_GET['user_email'] ?? null;

if (!$groupId || !$userEmail) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'ID de grupo y email de usuario son requeridos']);
    exit;
}

$userEmail = filter_var($userEmail, FILTER_SANITIZE_EMAIL);

try {
    $pdo->beginTransaction();

    $stmt = $pdo->prepare('
        SELECT
            g.id, g."groupName",
            (SELECT COUNT(*) FROM "NewsletterGroupItem" WHERE "groupId" = g.id) AS newsletter_count
        FROM "NewsletterGroup" g
        WHERE g.id = $1 AND g."userEmail" = $2
    ');
    $stmt->execute([$groupId, $userEmail]);
    $group = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$group) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Grupo no encontrado']);
        exit;
    }

    $deleteStmt = $pdo->prepare('DELETE FROM "NewsletterGroup" WHERE id = $1');
    $deleteStmt->execute([$groupId]);

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Grupo eliminado exitosamente',
        'deleted_group' => [
            'id' => $group['id'],
            'group_name' => $group['groupName'],
            'newsletters_removed' => (int) $group['newsletter_count']
        ]
    ]);

} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error al eliminar el grupo: ' . $e->getMessage()
    ]);
}
?>
