# codeql-playground

Build CodeQL database and set it as current anaylzed database immediately. This helps users to test their query on the changing test cases quickly, and boost the cycle to developing effiecient and robust queries

Right click the test cases folder and click the "Build CodeQL Database" or "Build CodeQL Database Mannually". The only difference between the two items in the context menu is that "Build CodeQL Database" will use none build-mode when building a CodeQL database. The database will be created without building the source root when using none build-mode. It is now available for JavaScript/TypeScript, Python, and Ruby. Also available in beta for Java.
