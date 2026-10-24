# GregTech6-Translation-Groupware

Next-stage translation works of Gregtech6-Chinese-Translation

## Compile

1. install MSVC compiler (C++11 Required)
2. install vcpkg
3. set env VCPKG_DEFAULT_TRIPLET, VCPKG_ROOT
4. install dependencies: ryml, boost_filesystem, boost_program_options, {fmt}
5. using CMake for compilation
6. run GT6TG.exe

## License

The translator program itself (file under `./src`) is under MIT License by Tanimodori.

The document of this program (file under `./doc`) is under CC0 Public Domain.

The original language file (`./workplace/en/GregTech.lang`) is treated as assets of GT6, so it's under CC0 Public Domain according to GT6's license.

The Chinese translation language file (`./workplace/zh/GregTech.fallback.lang`), text in config (`./workplace/config.yml`), and the released translation file are pure ideas or definitions of words and phrases, or program outputs. They are not copyrightable therefore under CC0 Public Domain.

## Credits

Thanks to Team Amamiya for the original translation.

Thanks to phi, TartaricAcid and CPFAOrg for technical support on weblate server.
