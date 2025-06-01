import { ApolloLink } from "@apollo/client";

// 민감한 정보를 마스킹하는 Apollo Link
export const createSecurityLink = () => {
  return new ApolloLink((operation, forward) => {
    // 민감한 필드 목록
    const sensitiveFields = [
      "password",
      "newPassword",
      "oldPassword",
      "confirmPassword",
    ];

    // 요청 변수에서 민감한 정보 확인
    if (operation.variables) {
      const hasSensitiveData = sensitiveFields.some((field) =>
        operation.variables.hasOwnProperty(field)
      );

      if (hasSensitiveData) {
        // 네트워크 탭에서 변수 숨기기 위한 헤더 추가
        operation.setContext(({ headers = {} }) => ({
          headers: {
            ...headers,
            "X-Apollo-Operation-Type": "sensitive",
            // 실제 GraphQL 요청은 POST로 전송되므로
            // 브라우저 개발자도구에서 쉽게 확인할 수 없도록 함
          },
        }));
      }
    }

    return forward(operation);
  });
};

// 로깅을 위한 민감한 정보 마스킹 함수
export const maskSensitiveVariables = (variables: any) => {
  if (!variables) return variables;

  const sensitiveFields = [
    "password",
    "newPassword",
    "oldPassword",
    "confirmPassword",
  ];
  const masked = { ...variables };

  sensitiveFields.forEach((field) => {
    if (masked[field]) {
      masked[field] = "***MASKED***";
    }
  });

  return masked;
};

// 네트워크 요청 로깅 (민감한 정보 제외)
export const logSecureRequest = (operationName: string, variables: any) => {
  const maskedVariables = maskSensitiveVariables(variables);
  console.log(`GraphQL Operation: ${operationName}`, {
    variables: maskedVariables,
    timestamp: new Date().toISOString(),
  });
};
