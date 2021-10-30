#ifndef DICTLANGRESULT_H
#define DICTLANGRESULT_H
#pragma once

#include <string>
#include <unordered_map>

#include "LangResult.hpp"

using std::string;
using std::unordered_map;

class DictLangResult : public virtual LangResult {
  using LangResult::LangResult;

private:
  const unordered_map<string, string> *_dict = nullptr;

public:
  DictLangResult(shared_ptr<IGeneratorMeta> meta,
                 const unordered_map<string, string> *dict);
  virtual const unordered_map<string, string> *result() override;
};
#endif