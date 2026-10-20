import "react";

declare module "react" {
  interface FormHTMLAttributes<T> {
    /** WebMCP declarative tool name (Chrome experimental API). */
    toolname?: string;
    /** WebMCP declarative tool description (Chrome experimental API). */
    tooldescription?: string;
    /** Allow the browser agent to submit only explicitly safe forms. */
    toolautosubmit?: string | boolean;
  }

  interface InputHTMLAttributes<T> {
    /** WebMCP schema description for this named field. */
    toolparamdescription?: string;
  }

  interface TextareaHTMLAttributes<T> {
    /** WebMCP schema description for this named field. */
    toolparamdescription?: string;
  }

  interface SelectHTMLAttributes<T> {
    /** WebMCP schema description for this named field. */
    toolparamdescription?: string;
  }
}
