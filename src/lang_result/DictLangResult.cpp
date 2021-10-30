#include "DictLangResult.hpp"

DictLangResult::DictLangResult(shared_ptr<IGeneratorMeta> meta,
                               const unordered_map<string, string> *dict)
    : LangResult(meta), _dict(dict) {}