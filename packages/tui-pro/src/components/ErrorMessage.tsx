import React from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";

export interface ErrorMessageProps {
  text: string;
}

export function ErrorMessage({ text }: ErrorMessageProps) {
  return (
    <Box
      borderStyle="single"
      borderColor={theme.error}
     
      paddingX={2}
      paddingY={1}
    >
      <Text color={theme.error}>✗ {text}</Text>
    </Box>
  );
}

export default ErrorMessage;
