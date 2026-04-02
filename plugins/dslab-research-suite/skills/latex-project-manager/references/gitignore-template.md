# LaTeX .gitignore Template

## Standard Template

```
# LaTeX build artifacts
*.aux
*.log
*.out
*.toc
*.bbl
*.blg
*.synctex.gz
*.fls
*.fdb_latexmk
*.nav
*.snm
*.vrb

# PDF output (compile locally or on Overleaf)
*.pdf

# OS files
.DS_Store
Thumbs.db

# Editor files
*.swp
*~
```

## Notes

- PDF는 기본적으로 제외 (Overleaf/로컬에서 컴파일)
- PDF를 포함하고 싶으면 `.gitignore`에서 `*.pdf` 줄 제거
- `.bbl` 제외: BibTeX에서 자동 생성되므로 불필요
- `refs.bib`는 반드시 포함 (소스 파일)
