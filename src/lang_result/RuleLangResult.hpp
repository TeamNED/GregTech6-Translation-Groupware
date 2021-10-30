#ifndef RULELANGRESULT_H
#define RULELANGRESULT_H
#pragma once

#include "../generator/Rule.hpp"
#include "LangResult.hpp"

class RuleLangResult : public virtual LangResult {
  using LangResult::LangResult;

private:
  const Rule *_rule;
  vector<shared_ptr<ILangResult>> _subs;
  pkvlist _result = nullptr;

public:
  RuleLangResult(shared_ptr<IGeneratorMeta> meta, const Rule *rule,
                 vector<shared_ptr<ILangResult>> subs);
};
#endif